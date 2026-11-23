package com.openframe.gateway.config.ws;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.junit.jupiter.api.Assertions.assertThrows;

class NatsClientStreamFilterTest {

    private static final String MACHINE_ID = "m-1";
    private static final String FOREIGN_SUBJECT = "machine.m-2.command-execution";
    private static final String OWN_SUBSCRIBE = "SUB machine.m-1.command-execution 1\r\n";
    private static final String FOREIGN_SUBSCRIBE = "SUB " + FOREIGN_SUBJECT + " 1\r\n";
    private static final String PING = "PING\r\n";
    private static final String CONNECT_DEVICE_USER = "CONNECT {\"verbose\":false,\"user\":\"machine\",\"pass\":\"\"}\r\n";
    private static final String CONNECT_WITH_PASSWORD = "CONNECT {\"user\":\"service\",\"pass\":\"secret\"}\r\n";
    private static final String CONNECT_WITH_TOKEN = "CONNECT {\"auth_token\":\"t0ken\"}\r\n";
    private static final boolean ENFORCE = true;
    private static final boolean OBSERVE = false;
    private static final int OVERLONG_LINE_BYTES = NatsClientStreamFilter.MAX_CONTROL_LINE_BYTES + 1;

    private final List<NatsViolation> violations = new ArrayList<>();

    private NatsClientStreamFilter filter;

    @BeforeEach
    void setUp() {
        NatsSubjectFilterProperties properties = new NatsSubjectFilterProperties();
        NatsClientIdentity identity = NatsClientIdentity.device(MACHINE_ID);
        NatsSubjectPolicy policy = NatsSubjectPolicy.of(properties, identity);
        filter = new NatsClientStreamFilter(policy, new ObjectMapper(), violations::add);
    }

    @Test
    void filter_ownMachineSubscribe_forwardedUnchanged() {
        // execution
        String forwarded = filter(OWN_SUBSCRIBE, ENFORCE);

        // verifications
        assertThat(forwarded).isEqualTo(OWN_SUBSCRIBE);
        assertThat(violations).isEmpty();
    }

    @Test
    void filter_foreignMachineSubscribeEnforcing_droppedAndReported() {
        // execution
        String forwarded = filter(FOREIGN_SUBSCRIBE, ENFORCE);

        // verifications
        assertThat(forwarded).isEmpty();
        assertThat(violations)
                .extracting(NatsViolation::operation, NatsViolation::detail)
                .containsExactly(tuple("SUB", FOREIGN_SUBJECT));
    }

    @Test
    void filter_foreignMachineSubscribeObserving_forwardedUnchangedAndReported() {
        // execution
        String forwarded = filter(FOREIGN_SUBSCRIBE, OBSERVE);

        // verifications
        assertThat(forwarded).isEqualTo(FOREIGN_SUBSCRIBE);
        assertThat(violations)
                .extracting(NatsViolation::operation, NatsViolation::detail)
                .containsExactly(tuple("SUB", FOREIGN_SUBJECT));
    }

    @Test
    void filter_severalCommandsInOneFrame_onlyTheRefusedOneDropped() {
        // setup
        String frame = PING + FOREIGN_SUBSCRIBE + OWN_SUBSCRIBE;

        // execution
        String forwarded = filter(frame, ENFORCE);

        // verifications
        assertThat(forwarded).isEqualTo(PING + OWN_SUBSCRIBE);
        assertThat(violations).hasSize(1);
    }

    @Test
    void filter_commandSplitAcrossFrames_heldBackUntilComplete() {
        // setup
        String head = "SUB machine.m-";
        String tail = "1.command-execution 1\r\n" + PING;

        // execution
        String forwardedHead = filter(head, ENFORCE);
        String forwardedTail = filter(tail, ENFORCE);

        // verifications
        assertThat(forwardedHead).isEmpty();
        assertThat(forwardedTail).isEqualTo(OWN_SUBSCRIBE + PING);
    }

    @Test
    void filter_subscribeWithQueueGroup_subjectIsTheSecondToken() {
        // setup
        String frame = "SUB " + FOREIGN_SUBJECT + " workers 7\r\n" + PING;

        // execution
        String forwarded = filter(frame, ENFORCE);

        // verifications
        assertThat(forwarded).isEqualTo(PING);
        assertThat(violations)
                .extracting(NatsViolation::detail)
                .containsExactly(FOREIGN_SUBJECT);
    }

    @Test
    void filter_lowerCaseVerb_vettedAllTheSame() {
        // setup
        String frame = "sub " + FOREIGN_SUBJECT + " 1\r\n";

        // execution
        String forwarded = filter(frame, ENFORCE);

        // verifications
        assertThat(forwarded).isEmpty();
        assertThat(violations).hasSize(1);
    }

    @Test
    void filter_bareNewlineTerminator_vettedAllTheSame() {
        // setup
        String frame = "SUB " + FOREIGN_SUBJECT + " 1\n";

        // execution
        String forwarded = filter(frame, ENFORCE);

        // verifications
        assertThat(forwarded).isEmpty();
        assertThat(violations).hasSize(1);
    }

    @Test
    void filter_publishPayloadThatLooksLikeACommand_copiedWithoutInspection() {
        // setup
        String payload = FOREIGN_SUBSCRIBE;
        String frame = "PUB machine.m-1.heartbeat " + payload.length() + "\r\n" + payload + "\r\n" + OWN_SUBSCRIBE;

        // execution
        String forwarded = filter(frame, ENFORCE);

        // verifications
        assertThat(forwarded).isEqualTo(frame);
        assertThat(violations).isEmpty();
    }

    @Test
    void filter_payloadSplitAcrossFrames_remainderCopiedThenParsingResumes() {
        // setup
        String head = "PUB machine.m-1.heartbeat 5\r\nab";
        String tail = "cde\r\n" + FOREIGN_SUBSCRIBE + PING;

        // execution
        String forwardedHead = filter(head, ENFORCE);
        String forwardedTail = filter(tail, ENFORCE);

        // verifications
        assertThat(forwardedHead).isEqualTo(head);
        assertThat(forwardedTail).isEqualTo("cde\r\n" + PING);
    }

    @Test
    void filter_publishWithReplySubject_sizeTakenFromTheLastToken() {
        // setup
        String frame = "PUB machine.m-1.hostname _INBOX.abc.1 2\r\nhi\r\n" + PING;

        // execution
        String forwarded = filter(frame, ENFORCE);

        // verifications
        assertThat(forwarded).isEqualTo(frame);
        assertThat(violations).isEmpty();
    }

    @Test
    void filter_foreignMachinePublish_droppedWithItsPayload() {
        // setup
        String frame = "PUB machine.m-2.heartbeat 2\r\nhi\r\n" + PING;

        // execution
        String forwarded = filter(frame, ENFORCE);

        // verifications
        assertThat(forwarded).isEqualTo(PING);
        assertThat(violations)
                .extracting(NatsViolation::operation, NatsViolation::detail)
                .containsExactly(tuple("PUB", "machine.m-2.heartbeat"));
    }

    @Test
    void filter_foreignMachinePublishPayloadSplitAcrossFrames_wholePayloadDropped() {
        // setup
        String head = "PUB machine.m-2.heartbeat 5\r\nab";
        String tail = "cde\r\n" + PING;

        // execution
        String forwardedHead = filter(head, ENFORCE);
        String forwardedTail = filter(tail, ENFORCE);

        // verifications
        assertThat(forwardedHead).isEmpty();
        assertThat(forwardedTail).isEqualTo(PING);
    }

    @Test
    void filter_foreignMachinePublishObserving_payloadKept() {
        // setup
        String frame = "PUB machine.m-2.heartbeat 2\r\nhi\r\n" + PING;

        // execution
        String forwarded = filter(frame, OBSERVE);

        // verifications
        assertThat(forwarded).isEqualTo(frame);
        assertThat(violations).hasSize(1);
    }

    @Test
    void filter_foreignMachineHeaderPublish_droppedWithHeadersAndPayload() {
        // setup
        String headers = "NATS/1.0\r\nX-Key: v\r\n\r\n";
        String body = "hello";
        int headerBytes = headers.length();
        int totalBytes = headerBytes + body.length();
        String frame = "HPUB machine.m-2.cmd " + headerBytes + " " + totalBytes + "\r\n" + headers + body + "\r\n" + PING;

        // execution
        String forwarded = filter(frame, ENFORCE);

        // verifications
        assertThat(forwarded).isEqualTo(PING);
        assertThat(violations)
                .extracting(NatsViolation::operation, NatsViolation::detail)
                .containsExactly(tuple("HPUB", "machine.m-2.cmd"));
    }

    @Test
    void filter_ownMachineHeaderPublish_forwardedUnchanged() {
        // setup
        String headers = "NATS/1.0\r\n\r\n";
        String body = "hello";
        int headerBytes = headers.length();
        int totalBytes = headerBytes + body.length();
        String frame = "HPUB machine.m-1.hostname " + headerBytes + " " + totalBytes + "\r\n" + headers + body + "\r\n";

        // execution
        String forwarded = filter(frame, ENFORCE);

        // verifications
        assertThat(forwarded).isEqualTo(frame);
        assertThat(violations).isEmpty();
    }

    @Test
    void filter_connectWithoutCredentials_forwardedUnchanged() {
        // execution
        String forwarded = filter(CONNECT_DEVICE_USER, ENFORCE);

        // verifications
        assertThat(forwarded).isEqualTo(CONNECT_DEVICE_USER);
        assertThat(violations).isEmpty();
    }

    @Test
    void filter_connectWithPasswordEnforcing_throwsAndReports() {
        // setup
        byte[] frame = CONNECT_WITH_PASSWORD.getBytes(UTF_8);

        // execution
        NatsStreamRejectedException exception = assertThrows(NatsStreamRejectedException.class,
                () -> filter.filter(frame, ENFORCE));

        // verifications
        assertThat(exception.getMessage()).contains("pass");
        assertThat(violations)
                .extracting(NatsViolation::operation, NatsViolation::detail)
                .containsExactly(tuple("CONNECT", "pass"));
    }

    @Test
    void filter_connectWithTokenObserving_forwardedAndReported() {
        // execution
        String forwarded = filter(CONNECT_WITH_TOKEN, OBSERVE);

        // verifications
        assertThat(forwarded).isEqualTo(CONNECT_WITH_TOKEN);
        assertThat(violations)
                .extracting(NatsViolation::operation, NatsViolation::detail)
                .containsExactly(tuple("CONNECT", "auth_token"));
    }

    @Test
    void filter_connectOptionsNotJsonEnforcing_throws() {
        // setup
        byte[] frame = "CONNECT not-json\r\n".getBytes(UTF_8);

        // execution
        NatsStreamRejectedException exception = assertThrows(NatsStreamRejectedException.class,
                () -> filter.filter(frame, ENFORCE));

        // verifications
        assertThat(exception.getMessage()).contains("JSON");
    }

    @Test
    void filter_publishSizeNotANumberEnforcing_throwsAndReports() {
        // setup
        byte[] frame = "PUB machine.m-1.heartbeat abc\r\n".getBytes(UTF_8);

        // execution
        NatsStreamRejectedException exception = assertThrows(NatsStreamRejectedException.class,
                () -> filter.filter(frame, ENFORCE));

        // verifications
        assertThat(exception.getMessage()).contains("payload size");
        assertThat(violations)
                .extracting(NatsViolation::operation)
                .containsExactly("PROTOCOL");
    }

    @Test
    void filter_controlLineOverflowEnforcing_throws() {
        // setup
        byte[] frame = overlongLine();

        // execution
        NatsStreamRejectedException exception = assertThrows(NatsStreamRejectedException.class,
                () -> filter.filter(frame, ENFORCE));

        // verifications
        assertThat(exception.getMessage()).contains("control line");
    }

    @Test
    void filter_controlLineOverflowObserving_forwardedAndTheRestRelayedUnfiltered() {
        // setup
        byte[] overlong = overlongLine();

        // execution
        byte[] forwardedOverlong = filter.filter(overlong, OBSERVE);
        String forwardedNext = filter(FOREIGN_SUBSCRIBE, OBSERVE);

        // verifications
        assertThat(forwardedOverlong).isEqualTo(overlong);
        assertThat(forwardedNext).isEqualTo(FOREIGN_SUBSCRIBE);
        assertThat(violations)
                .extracting(NatsViolation::operation)
                .containsExactly("PROTOCOL");
    }

    @Test
    void filter_keepAliveAndUnsubscribe_forwardedUnchanged() {
        // setup
        String frame = "UNSUB 1\r\n" + PING + "PONG\r\n";

        // execution
        String forwarded = filter(frame, ENFORCE);

        // verifications
        assertThat(forwarded).isEqualTo(frame);
        assertThat(violations).isEmpty();
    }

    @Test
    void filter_emptyFrame_nothingForwarded() {
        // execution
        String forwarded = filter("", ENFORCE);

        // verifications
        assertThat(forwarded).isEmpty();
    }

    private String filter(String frame, boolean enforce) {
        byte[] bytes = frame.getBytes(UTF_8);
        byte[] forwarded = filter.filter(bytes, enforce);
        return new String(forwarded, UTF_8);
    }

    private static byte[] overlongLine() {
        byte[] line = new byte[OVERLONG_LINE_BYTES];
        Arrays.fill(line, (byte) 'A');
        return line;
    }
}
