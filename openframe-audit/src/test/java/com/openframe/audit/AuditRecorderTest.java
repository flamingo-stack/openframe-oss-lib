package com.openframe.audit;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.openframe.data.document.apikey.ApiKey;
import com.openframe.data.document.audit.AuditAction;
import com.openframe.data.document.audit.AuditActorType;
import com.openframe.data.document.audit.AuditOutcome;
import com.openframe.data.model.audit.AuditActor;
import com.openframe.data.model.audit.AuditEntry;
import com.openframe.data.model.audit.AuditRequestInfo;
import com.openframe.data.repository.apikey.ApiKeyRepository;
import com.openframe.data.service.AuditTenantResolver;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.slf4j.LoggerFactory;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Supplier;

import static com.openframe.core.constants.HttpHeaders.X_API_KEY_ID;
import static com.openframe.core.constants.HttpHeaders.X_USER_ID;
import static com.openframe.data.model.audit.AuditConstants.ACTOR_ATTRIBUTE;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuditRecorderTest {

    private static final String SUPER_TENANT_ID = "super-tenant";
    private static final String SERVED_TENANT_ID = "tenant-1";
    private static final String USER_ID = "user-1";
    private static final String MACHINE_ID = "machine-1";
    private static final String ENDPOINT = "GET /api/users";
    private static final AuditRequestInfo REQUEST_INFO =
            new AuditRequestInfo("203.0.113.5", "Mingo", "request-7", "session-7");

    @Mock private ApiKeyRepository apiKeyRepository;
    @Mock private AuditTenantResolver tenantResolver;
    @Mock private AuditOutcomeResolver outcomeResolver;
    @Mock private AuditEventWriter writer;
    @Captor private ArgumentCaptor<List<AuditEntry>> entriesCaptor;
    @Captor private ArgumentCaptor<AuditContext> contextCaptor;

    private final Logger logger = (Logger) LoggerFactory.getLogger(AuditRecorder.class);
    private final ListAppender<ILoggingEvent> appender = new ListAppender<>();
    private AuditContext seenInside;

    private AuditRecorder recorder;

    @BeforeEach
    void setUp() {
        recorder = new AuditRecorder(apiKeyRepository, tenantResolver, outcomeResolver, writer, true);
        appender.start();
        logger.addAppender(appender);
    }

    @AfterEach
    void clearContexts() {
        SecurityContextHolder.clearContext();
        RequestContextHolder.resetRequestAttributes();
        logger.detachAppender(appender);
    }

    @Test
    void context_userToken_isTheUserOfTheToken() {
        when(tenantResolver.superTenantId()).thenReturn(SUPER_TENANT_ID);
        signIn(USER_ID, SERVED_TENANT_ID, Map.of("email", "anna@acme.com", "roles", List.of("ADMIN")));

        assertThat(recorder.context().actor()).isEqualTo(
                AuditActor.fromUser(USER_ID, "anna@acme.com", List.of("ADMIN"), SERVED_TENANT_ID, SUPER_TENANT_ID));
    }

    @Test
    void context_platformTenantToken_isStaff() {
        when(tenantResolver.superTenantId()).thenReturn(SUPER_TENANT_ID);
        signIn("staff-1", SUPER_TENANT_ID, Map.of("roles", List.of("ADMIN")));

        assertThat(recorder.context().actor().type()).isEqualTo(AuditActorType.STAFF);
    }

    @Test
    void context_agentToken_isTheDeviceOfItsMachine() {
        signIn("agent-client", SERVED_TENANT_ID, Map.of("roles", List.of("AGENT"), "machine_id", MACHINE_ID));

        assertThat(recorder.context().actor())
                .isEqualTo(AuditActor.fromAgent(MACHINE_ID, List.of("AGENT"), SERVED_TENANT_ID));
    }

    @Test
    void context_requestDeclaresAnActor_takesItOverTheToken() {
        signIn(USER_ID, SERVED_TENANT_ID, Map.of("roles", List.of("ADMIN")));
        currentRequest().setAttribute(ACTOR_ATTRIBUTE, AuditActor.staff("staff-2"));

        assertThat(recorder.context().actor()).isEqualTo(AuditActor.staff("staff-2"));
    }

    @Test
    void context_tokenAndApiKeyHeader_takesTheTokenActor() {
        when(tenantResolver.superTenantId()).thenReturn(SUPER_TENANT_ID);
        signIn(USER_ID, SERVED_TENANT_ID, Map.of("email", "anna@acme.com", "roles", List.of("ADMIN")));
        currentRequest().addHeader(X_API_KEY_ID, "key-1");

        assertThat(recorder.context().actor()).isEqualTo(
                AuditActor.fromUser(USER_ID, "anna@acme.com", List.of("ADMIN"), SERVED_TENANT_ID, SUPER_TENANT_ID));
    }

    @Test
    void context_apiKeyHeader_isTheKeyActingForItsOwner() {
        MockHttpServletRequest request = currentRequest();
        request.addHeader(X_API_KEY_ID, "key-1");
        request.addHeader(X_USER_ID, USER_ID);
        when(apiKeyRepository.findById("key-1")).thenReturn(Optional.of(ApiKey.builder()
                .keyId("key-1")
                .name("Billing sync")
                .roles(List.of("ADMIN"))
                .tenantId("tenant-3")
                .build()));

        assertThat(recorder.context().actor())
                .isEqualTo(AuditActor.fromApiKey("key-1", "Billing sync", List.of("ADMIN"), "tenant-3", USER_ID));
    }

    @Test
    void context_unknownApiKey_isTheKeyByItsId() {
        MockHttpServletRequest request = currentRequest();
        request.addHeader(X_API_KEY_ID, "key-9");
        request.addHeader(X_USER_ID, USER_ID);
        when(apiKeyRepository.findById("key-9")).thenReturn(Optional.empty());

        assertThat(recorder.context().actor()).isEqualTo(AuditActor.fromApiKey("key-9", null, null, null, USER_ID));
    }

    @Test
    void context_noTokenAndNoApiKey_isTheSystem() {
        currentRequest();

        assertThat(recorder.context().actor()).isEqualTo(AuditActor.system());
    }

    @Test
    void context_actorGivenOutsideAnyContext_takesTheSourceOfTheRequest() {
        currentRequest().addHeader("X-Client-Ip", "203.0.113.24");
        AuditActor job = AuditActor.system("invoice-sync");

        assertThat(recorder.context(job))
                .extracting(AuditContext::actor, context -> context.requestInfo().ip(), AuditContext::parentEventId)
                .containsExactly(job, "203.0.113.24", null);
    }

    @Test
    void context_actorGivenInsideADeclaredContext_keepsItsSourceAndEvent() {
        AuditActor job = AuditActor.system("invoice-sync");

        AuditContext context = recorder.runInContext(declaredContext("event-1"), () -> recorder.context(job));

        assertThat(context).isEqualTo(new AuditContext(job, REQUEST_INFO, "event-1"));
    }

    @Test
    void requestInfo_tokenWithSessionAndALoginSession_takesTheTokensSession() {
        signIn(USER_ID, SERVED_TENANT_ID, Map.of("roles", List.of("ADMIN"), "sid", "session-1"));
        currentRequest().setSession(new MockHttpSession(null, "login-session"));

        assertThat(recorder.requestInfo().sessionId()).isEqualTo("session-1");
    }

    @Test
    void requestInfo_loginSessionWithoutToken_isTheHashOfTheSessionId() {
        currentRequest().setSession(new MockHttpSession(null, "abc"));

        assertThat(recorder.requestInfo().sessionId())
                .isEqualTo("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    }

    @Test
    void requestInfo_noTokenAndNoLoginSession_hasNoSession() {
        currentRequest();

        assertThat(recorder.requestInfo().sessionId()).isNull();
    }

    @Test
    void requestInfo_noRequest_isEmpty() {
        assertThat(recorder.requestInfo()).isEqualTo(new AuditRequestInfo(null, null, null, null));
    }

    @Test
    void record_entryWithContext_handsItToTheWriterUnderThatContext() {
        AuditEntry entry = entry();
        AuditContext context = declaredContext("event-0");

        recorder.record(entry, context);

        verify(writer).write(List.of(entry), context, true);
    }

    @Test
    void record_entryWithoutContext_handsItToTheWriterUnderTheCallersContext() {
        AuditEntry entry = entry();
        currentRequest().setAttribute(ACTOR_ATTRIBUTE, AuditActor.staff("staff-2"));

        recorder.record(entry);

        verify(writer).write(eq(List.of(entry)), contextCaptor.capture(), eq(true));
        assertThat(contextCaptor.getValue().actor()).isEqualTo(AuditActor.staff("staff-2"));
    }

    @Test
    void record_entryWithActor_handsItToTheWriterUnderThatActor() {
        AuditEntry entry = entry();
        AuditActor job = AuditActor.system("invoice-sync");

        recorder.record(entry, job);

        verify(writer).write(eq(List.of(entry)), contextCaptor.capture(), eq(true));
        assertThat(contextCaptor.getValue().actor()).isEqualTo(job);
    }

    @Test
    void record_entryWithoutOutcome_throws() {
        AuditEntry entry = AuditEntry.builder().action(AuditAction.TICKET_ARCHIVE).build();

        assertThatThrownBy(() -> recorder.record(entry))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("An audit entry needs an outcome");
    }

    @Test
    void record_auditOff_recordsNothing() {
        AuditRecorder off = new AuditRecorder(apiKeyRepository, tenantResolver, outcomeResolver, writer, false);

        boolean recorded = off.record(entry());

        assertThat(recorded).isFalse();
        verifyNoInteractions(writer);
    }

    @Test
    void record_eventStored_returnsTrue() {
        AuditEntry entry = entry();
        AuditContext context = declaredContext(null);
        when(writer.write(List.of(entry), context, true)).thenReturn(true);

        boolean recorded = recorder.record(entry, context);

        assertThat(recorded).isTrue();
    }

    @Test
    void record_writerBreaks_logsTheEntriesAndReturnsFalse() {
        AuditEntry entry = ticketArchive("ticket-1");
        AuditContext context = declaredContext(null);
        when(writer.write(List.of(entry), context, true))
                .thenThrow(new IllegalArgumentException("No enum constant UserStatus.ARCHIVED"));

        boolean recorded = recorder.record(entry, context);

        assertThat(recorded).isFalse();
        assertThat(appender.list).extracting(ILoggingEvent::getFormattedMessage).singleElement().asString()
                .startsWith("Audit events not recorded: [AuditEntry(")
                .contains("action=TICKET_ARCHIVE", "targetId=ticket-1");
    }

    @Test
    void record_callerCannotBeRead_logsTheEntriesAndRecordsNothing() {
        currentRequest().addHeader(X_API_KEY_ID, "key-1");
        when(apiKeyRepository.findById("key-1"))
                .thenThrow(new IllegalArgumentException("No enum constant ApiKeyStatus.PAUSED"));

        boolean recorded = recorder.record(ticketArchive("ticket-1"));

        assertThat(recorded).isFalse();
        assertThat(appender.list).extracting(ILoggingEvent::getFormattedMessage).singleElement().asString()
                .startsWith("Audit events not recorded: [AuditEntry(")
                .contains("action=TICKET_ARCHIVE", "targetId=ticket-1");
        verifyNoInteractions(writer);
    }

    @Test
    void record_contextWithoutEventInsideADeclaredEvent_hangsUnderIt() {
        AuditEntry entry = entry();
        AuditActor job = AuditActor.system("invoice-sync");

        recorder.runInContext(declaredContext("event-1"),
                () -> recorder.record(entry, new AuditContext(job, REQUEST_INFO, null)));

        verify(writer).write(List.of(entry), new AuditContext(job, REQUEST_INFO, "event-1"), true);
    }

    @Test
    void record_contextWithItsOwnEventInsideADeclaredEvent_keepsItsOwnEvent() {
        AuditEntry entry = entry();
        AuditContext own = new AuditContext(AuditActor.system("invoice-sync"), REQUEST_INFO, "event-2");

        recorder.runInContext(declaredContext("event-1"), () -> recorder.record(entry, own));

        verify(writer).write(List.of(entry), own, true);
    }

    @Test
    void recordCaptured_entry_handsItToTheWriterWithoutLoadingItsTarget() {
        AuditEntry entry = ticketArchive("ticket-1");
        AuditContext context = declaredContext(null);

        recorder.recordCaptured(entry, context);

        verify(writer).write(List.of(entry), context, false);
    }

    @Test
    void runInContext_runnableWork_runsUnderTheDeclaredContext() {
        AuditContext declared = declaredContext("event-1");

        recorder.runInContext(declared, () -> {
            seenInside = recorder.context();
        });

        assertThat(seenInside).isEqualTo(declared);
    }

    @Test
    void runInContext_contextWithoutEventInsideADeclaredEvent_hangsUnderIt() {
        AuditContext inner = new AuditContext(AuditActor.system("invoice-sync"), REQUEST_INFO, null);

        AuditContext context = recorder.runInContext(declaredContext("event-1"),
                () -> recorder.runInContext(inner, () -> recorder.context()));

        assertThat(context.parentEventId()).isEqualTo("event-1");
    }

    @Test
    void runInContext_innerContextEnds_restoresTheOuterOne() {
        AuditContext outer = declaredContext("event-1");

        AuditContext context = recorder.runInContext(outer, () -> {
            recorder.runInContext(new AuditContext(AuditActor.system("invoice-sync"), REQUEST_INFO, "event-2"), () -> {
            });
            return recorder.context();
        });

        assertThat(context).isEqualTo(outer);
    }

    @Test
    void runInContext_workThrows_leavesNoContextBehind() {
        assertThatThrownBy(() -> recorder.runInContext(declaredContext("event-1"), () -> {
            throw new IllegalStateException("job failed");
        })).isInstanceOf(IllegalStateException.class).hasMessage("job failed");

        assertThat(recorder.parentEventId()).isNull();
    }

    @Test
    void wrapInCurrentContext_runOutsideTheContext_runsUnderTheCallersContext() {
        AuditContext declared = declaredContext("event-1");
        Supplier<AuditContext> later = recorder.runInContext(declared, () -> recorder.wrapInCurrentContext(recorder::context));

        assertThat(later.get()).isEqualTo(declared);
    }

    @Test
    void recordOnce_sameKeyTwice_recordsOnce() {
        AuditEntry denial = denial();

        recorder.recordOnce(denial, ENDPOINT);
        recorder.recordOnce(denial, ENDPOINT);

        verify(writer).write(eq(List.of(denial)), any(), eq(true));
    }

    @Test
    void recordOnce_otherKey_recordsItToo() {
        AuditEntry denial = denial();

        recorder.recordOnce(denial, ENDPOINT);
        recorder.recordOnce(denial, "GET /api/devices");

        verify(writer, times(2)).write(eq(List.of(denial)), any(), eq(true));
    }

    @Test
    void recordOnce_sameKeyForAnotherActor_recordsItToo() {
        AuditEntry denial = denial();

        recorder.recordOnce(denial, ENDPOINT, AuditActor.system("invoice-sync"));
        recorder.recordOnce(denial, ENDPOINT, AuditActor.system("script-watchdog"));

        verify(writer, times(2)).write(eq(List.of(denial)), any(), eq(true));
    }

    @Test
    void recordOnce_sameKeyInAnotherTenant_recordsItToo() {
        AuditEntry inOneTenant = denial().toBuilder().tenantId("tenant-1").build();
        AuditEntry inAnotherTenant = denial().toBuilder().tenantId("tenant-2").build();
        when(tenantResolver.tenantFor(AuditActor.system(), "tenant-1")).thenReturn("tenant-1");
        when(tenantResolver.tenantFor(AuditActor.system(), "tenant-2")).thenReturn("tenant-2");

        recorder.recordOnce(inOneTenant, ENDPOINT);
        recorder.recordOnce(inAnotherTenant, ENDPOINT);

        verify(writer).write(eq(List.of(inOneTenant)), any(), eq(true));
        verify(writer).write(eq(List.of(inAnotherTenant)), any(), eq(true));
    }

    @Test
    void recordOnce_callerCannotBeRead_logsAndRecordsNothing() {
        currentRequest().addHeader(X_API_KEY_ID, "key-1");
        when(apiKeyRepository.findById("key-1"))
                .thenThrow(new IllegalArgumentException("No enum constant ApiKeyStatus.PAUSED"));

        recorder.recordOnce(denial(), ENDPOINT);

        assertThat(appender.list).extracting(ILoggingEvent::getFormattedMessage)
                .containsExactly("Audit event not recorded for auth.access.refuse");
        verifyNoInteractions(writer);
    }

    @Test
    void recordFailure_exception_recordsTheOutcomeAndReasonOfTheResolver() {
        IllegalArgumentException failure = new IllegalArgumentException("Ticket is archived");
        when(outcomeResolver.ofFailure(failure))
                .thenReturn(new ActionOutcome(AuditOutcome.REFUSED, "Refused: archived"));

        recorder.recordFailure(AuditEntry.builder().action(AuditAction.TICKET_ARCHIVE), failure);

        assertThat(recordedEntries()).extracting(AuditEntry::getOutcome, AuditEntry::getReason)
                .containsExactly(tuple(AuditOutcome.REFUSED, "Refused: archived"));
    }

    @Test
    void recordUnresolvedFailure_exception_recordsTheOutcomeAndReasonOfTheResolver() {
        RuntimeException failure = new RuntimeException("Stripe did not answer");
        when(outcomeResolver.ofFailure(failure))
                .thenReturn(new ActionOutcome(AuditOutcome.FAILURE, "RuntimeException"));

        recorder.recordUnresolvedFailure(AuditEntry.builder().action(AuditAction.TICKET_ARCHIVE), failure, "invoice-1");

        assertThat(recordedEntries()).extracting(AuditEntry::getOutcome, AuditEntry::getReason)
                .containsExactly(tuple(AuditOutcome.FAILURE, "RuntimeException"));
    }

    @Test
    void recordUnresolvedFailure_sameKeyTwice_recordsOnce() {
        AuditEntry failure = failure();
        when(writer.write(eq(List.of(failure)), any(), eq(true))).thenReturn(true);

        recorder.recordUnresolvedFailure(failure, "invoice-1");
        recorder.recordUnresolvedFailure(failure, "invoice-1");

        verify(writer).write(eq(List.of(failure)), any(), eq(true));
    }

    @Test
    void recordUnresolvedFailure_failureResolved_recordsItAgain() {
        AuditEntry failure = failure();
        when(writer.write(eq(List.of(failure)), any(), eq(true))).thenReturn(true);

        recorder.recordUnresolvedFailure(failure, "invoice-1");
        recorder.failureResolved(AuditAction.TICKET_ARCHIVE, "invoice-1");
        recorder.recordUnresolvedFailure(failure, "invoice-1");

        verify(writer, times(2)).write(eq(List.of(failure)), any(), eq(true));
    }

    @Test
    void recordUnresolvedFailure_otherKey_recordsItToo() {
        AuditEntry failure = failure();

        recorder.recordUnresolvedFailure(failure, "invoice-1");
        recorder.recordUnresolvedFailure(failure, "invoice-2");

        verify(writer, times(2)).write(eq(List.of(failure)), any(), eq(true));
    }

    @Test
    void recordUnresolvedFailure_firstEventNotStored_recordsItAgainOnce() {
        AuditEntry failure = failure();
        when(writer.write(eq(List.of(failure)), any(), eq(true))).thenReturn(false, true);

        recorder.recordUnresolvedFailure(failure, "invoice-1");
        recorder.recordUnresolvedFailure(failure, "invoice-1");
        recorder.recordUnresolvedFailure(failure, "invoice-1");

        verify(writer, times(2)).write(eq(List.of(failure)), any(), eq(true));
    }

    @Test
    void recordAll_entries_handsThemToTheWriterInOneCall() {
        List<AuditEntry> entries = List.of(ticketArchive("ticket-1"), ticketArchive("ticket-2"));

        recorder.recordAll(entries);

        verify(writer).write(eq(entries), any(), eq(true));
    }

    @Test
    void recordAll_noEntries_recordsNothing() {
        recorder.recordAll(List.of());

        verifyNoInteractions(writer);
    }

    @Test
    void recordAll_entryWithoutOutcomeAmongOthers_throws() {
        List<AuditEntry> entries = List.of(entry(),
                AuditEntry.builder().action(AuditAction.TICKET_ARCHIVE).build());

        assertThatThrownBy(() -> recorder.recordAll(entries))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("An audit entry needs an outcome");
    }

    private List<AuditEntry> recordedEntries() {
        verify(writer).write(entriesCaptor.capture(), any(), eq(true));
        return entriesCaptor.getValue();
    }

    private static AuditContext declaredContext(String parentEventId) {
        return new AuditContext(AuditActor.system("script-watchdog"), REQUEST_INFO, parentEventId);
    }

    private static AuditEntry entry() {
        return AuditEntry.builder().action(AuditAction.TICKET_ARCHIVE).outcome(AuditOutcome.SUCCESS).build();
    }

    private static AuditEntry ticketArchive(String ticketId) {
        return entry().toBuilder().targetId(ticketId).build();
    }

    private static AuditEntry denial() {
        return AuditEntry.builder().action(AuditAction.AUTH_ACCESS_REFUSE).outcome(AuditOutcome.REFUSED).build();
    }

    private static AuditEntry failure() {
        return AuditEntry.builder().action(AuditAction.TICKET_ARCHIVE).outcome(AuditOutcome.FAILURE).build();
    }

    private static MockHttpServletRequest currentRequest() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
        return request;
    }

    private static void signIn(String subject, String tenantId, Map<String, Object> claims) {
        Jwt jwt = Jwt.withTokenValue("token")
                .header("alg", "none")
                .subject(subject)
                .claim("tenant_id", tenantId)
                .claims(all -> all.putAll(claims))
                .build();
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt));
    }
}
