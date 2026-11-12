package com.openframe.data.reactive.service;

import com.openframe.data.document.audit.AuditAction;
import com.openframe.data.document.audit.AuditActorType;
import com.openframe.data.document.audit.AuditEvent;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.user.User;
import com.openframe.data.mapper.AuditEventMapper;
import com.openframe.data.model.audit.AuditActor;
import com.openframe.data.model.audit.AuditEntry;
import com.openframe.data.model.audit.AuditRequestInfo;
import com.openframe.data.reactive.repository.audit.ReactiveAuditEventRepository;
import com.openframe.data.reactive.repository.device.ReactiveMachineRepository;
import com.openframe.data.reactive.repository.user.ReactiveUserRepository;
import com.openframe.data.repository.redis.ReactiveAuditOnceRepository;
import com.openframe.data.service.AuditClock;
import com.openframe.data.service.AuditTenantResolver;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.data.redis.RedisConnectionFailureException;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import tools.jackson.databind.json.JsonMapper;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

import static com.openframe.data.document.audit.AuditAction.API_KEY_RATE_LIMIT_REFUSE;
import static com.openframe.data.document.audit.AuditAction.AUTH_ACCESS_REFUSE;
import static com.openframe.data.document.audit.AuditAction.STAFF_TENANT_ACCESS_START;
import static com.openframe.data.document.audit.AuditAction.TOOL_ENDPOINT_REFUSE;
import static com.openframe.data.document.audit.AuditActorType.STAFF;
import static com.openframe.data.document.audit.AuditActorType.USER;
import static com.openframe.data.document.audit.AuditOutcome.REFUSED;
import static com.openframe.data.document.audit.AuditOutcome.SUCCESS;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith({MockitoExtension.class, OutputCaptureExtension.class})
class ReactiveAuditEventWriterTest {

    private static final AuditRequestInfo REQUEST_INFO =
            new AuditRequestInfo("203.0.113.24", "Mozilla/5.0", "request-1", null);
    private static final String SERVED_TENANT = "tenant-a";
    private static final Duration ONE_MINUTE = Duration.ofMinutes(1);
    private static final Instant NOW = Instant.parse("2026-10-28T14:12:00Z");
    private static final AuditActor NAMED_KEY = AuditActor.fromApiKey("key-1", "CI key", List.of("ADMIN"), null, null);
    private static final String RATE_LIMITED_PATH = "/api/v1/devices";
    private static final String RATE_LIMIT_CLAIM = "api_key.rate_limit.refuse:/api/v1/devices:key-1";

    @Mock
    private ReactiveAuditEventRepository auditEventRepository;
    @Mock
    private ReactiveUserRepository userRepository;
    @Mock
    private ReactiveMachineRepository machineRepository;
    @Mock
    private ReactiveAuditOnceRepository auditOnceRepository;
    @Mock
    private AuditEventMapper auditEventMapper;
    @Mock
    private AuditTenantResolver tenantResolver;
    @Mock
    private AuditClock auditClock;
    @Captor
    private ArgumentCaptor<List<AuditEvent>> inserted;

    private ReactiveAuditEventWriter writer;

    @BeforeEach
    void setUp() {
        writer = writerWith(true);
    }

    @Test
    void writeAll_entryWithoutAction_throws() {
        AuditEntry entry = AuditEntry.builder().outcome(REFUSED).build();

        assertThatThrownBy(() -> writer.writeAll(List.of(entry), callerOf(NAMED_KEY)))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("An audit entry needs an action");
    }

    @Test
    void writeAll_auditDisabled_recordsNothing() {
        writerWith(false).writeAll(List.of(entry(AUTH_ACCESS_REFUSE)), callerOf(NAMED_KEY)).block();

        verifyNoInteractions(auditEventMapper, auditEventRepository);
    }

    @Test
    void writeAll_noEntries_recordsNothing() {
        writer.writeAll(List.of(), callerOf(NAMED_KEY)).block();

        verifyNoInteractions(auditEventRepository);
    }

    @ParameterizedTest
    @EnumSource(value = AuditActorType.class, names = {"USER", "STAFF"})
    void writeAll_personActor_namesEveryEventAfterUserRecord(AuditActorType type) {
        AuditActor person = person(type, "user-1");
        AuditEntry denied = entry(AUTH_ACCESS_REFUSE);
        AuditEntry toolDenied = entry(TOOL_ENDPOINT_REFUSE);
        AuditEvent first = mapped(denied, person, SERVED_TENANT);
        AuditEvent second = mapped(toolDenied, person, SERVED_TENANT);
        when(auditEventRepository.insert(List.of(first, second))).thenReturn(Flux.just(first, second));
        when(userRepository.findById("user-1")).thenReturn(Mono.just(user("Anna", "Kowalski")));

        writer.writeAll(List.of(denied, toolDenied), callerOf(person)).block();

        assertThat(insertedEvents()).extracting(AuditEvent::getActorName)
                .containsExactly("Anna Kowalski", "Anna Kowalski");
    }

    @Test
    void writeAll_deviceActor_namesEventAfterMachineHostname() {
        AuditActor agent = AuditActor.fromAgent("machine-1", List.of("AGENT"), null);
        AuditEntry entry = entry(AUTH_ACCESS_REFUSE);
        stored(entry, agent, SERVED_TENANT);
        when(machineRepository.findByMachineId("machine-1")).thenReturn(Mono.just(laptop()));

        writer.writeAll(List.of(entry), callerOf(agent)).block();

        assertThat(insertedEvents()).extracting(AuditEvent::getActorName).containsExactly("LAPTOP-7F3A");
    }

    @Test
    void writeAll_actorWithName_keepsThatName() {
        AuditEntry entry = entry(AUTH_ACCESS_REFUSE);
        stored(entry, NAMED_KEY, SERVED_TENANT);

        writer.writeAll(List.of(entry), callerOf(NAMED_KEY)).block();

        assertThat(insertedEvents()).extracting(AuditEvent::getActorName).containsExactly("CI key");
    }

    @Test
    void writeAll_actorWithoutId_storesEventWithoutLookup() {
        AuditActor withoutId = person(USER, null);
        AuditEntry entry = entry(AUTH_ACCESS_REFUSE);
        stored(entry, withoutId, SERVED_TENANT);

        writer.writeAll(List.of(entry), callerOf(withoutId)).block();

        verifyNoInteractions(userRepository);
    }

    @Test
    void writeAll_apiKeyActorWithoutName_storesEventWithoutLookup() {
        AuditActor unknownKey = AuditActor.fromApiKey("key-1", null, null, null, null);
        AuditEntry entry = entry(AUTH_ACCESS_REFUSE);
        stored(entry, unknownKey, SERVED_TENANT);

        writer.writeAll(List.of(entry), callerOf(unknownKey)).block();

        verifyNoInteractions(userRepository, machineRepository);
    }

    @Test
    void writeAll_userRecordGone_storesEventWithoutActorName() {
        AuditActor person = person(USER, "user-1");
        AuditEntry entry = entry(AUTH_ACCESS_REFUSE);
        stored(entry, person, SERVED_TENANT);
        when(userRepository.findById("user-1")).thenReturn(Mono.empty());

        writer.writeAll(List.of(entry), callerOf(person)).block();

        assertThat(insertedEvents()).extracting(AuditEvent::getActorName).containsOnlyNulls();
    }

    @Test
    void writeAll_userRecordWithoutName_storesEventWithoutActorName() {
        AuditActor person = person(USER, "user-1");
        AuditEntry entry = entry(AUTH_ACCESS_REFUSE);
        stored(entry, person, SERVED_TENANT);
        when(userRepository.findById("user-1")).thenReturn(Mono.just(user(null, null)));

        writer.writeAll(List.of(entry), callerOf(person)).block();

        assertThat(insertedEvents()).extracting(AuditEvent::getActorName).containsOnlyNulls();
    }

    @Test
    void writeAll_nameLookupFails_storesEventAndLogsFailure(CapturedOutput output) {
        AuditActor person = person(USER, "user-1");
        AuditEntry entry = entry(AUTH_ACCESS_REFUSE);
        stored(entry, person, SERVED_TENANT);
        when(userRepository.findById("user-1"))
                .thenReturn(Mono.error(new DataAccessResourceFailureException("Mongo unreachable")));

        writer.writeAll(List.of(entry), callerOf(person)).block();

        assertThat(insertedEvents()).extracting(AuditEvent::getActorName).containsOnlyNulls();
        assertThat(output).contains("Audit lookup failed, the event is stored without its result");
    }

    @Test
    void writeAll_apiKeyActorWithOwner_namesOnBehalfOfAfterOwnerRecord() {
        AuditActor keyOfOwner = AuditActor.fromApiKey("key-1", "CI key", List.of("ADMIN"), null, "user-7");
        AuditEntry entry = entry(AUTH_ACCESS_REFUSE);
        stored(entry, keyOfOwner, SERVED_TENANT);
        when(userRepository.findById("user-7")).thenReturn(Mono.just(user("Ben", "Ortiz")));

        writer.writeAll(List.of(entry), callerOf(keyOfOwner)).block();

        assertThat(insertedEvents()).extracting(AuditEvent::getOnBehalfOfName).containsExactly("Ben Ortiz");
    }

    @Test
    void writeAll_faeActor_namesOnBehalfOfAfterMachineHostname() {
        AuditActor fae = AuditActor.fae("machine-1");
        AuditEntry entry = entry(AUTH_ACCESS_REFUSE);
        stored(entry, fae, SERVED_TENANT);
        when(machineRepository.findByMachineId("machine-1")).thenReturn(Mono.just(laptop()));

        writer.writeAll(List.of(entry), callerOf(fae)).block();

        assertThat(insertedEvents()).extracting(AuditEvent::getOnBehalfOfName).containsExactly("LAPTOP-7F3A");
    }

    @Test
    void writeAll_entryNamesTenant_storesEventUnderThatTenant() {
        AuditEntry entry = AuditEntry.builder().action(AUTH_ACCESS_REFUSE).outcome(REFUSED).tenantId("tenant-b").build();
        stored(entry, NAMED_KEY, "tenant-b");

        writer.writeAll(List.of(entry), callerOf(NAMED_KEY)).block();

        assertThat(insertedEvents()).extracting(AuditEvent::getTenantId).containsExactly("tenant-b");
    }

    @Test
    void writeAll_callerFails_completesAndLogsFailure(CapturedOutput output) {
        writer.writeAll(List.of(entry(AUTH_ACCESS_REFUSE)),
                Mono.error(new IllegalArgumentException("Unsupported roles claim"))).block();

        assertThat(output).contains("Audit event not recorded for auth.access.refuse");
    }

    @Test
    void writeAll_insertFails_completesAndLogsEventsAsJson(CapturedOutput output) {
        AuditEntry entry = entry(AUTH_ACCESS_REFUSE);
        AuditEvent event = mapped(entry, NAMED_KEY, SERVED_TENANT);
        when(auditEventRepository.insert(List.of(event)))
                .thenReturn(Flux.error(new DataAccessResourceFailureException("Mongo unreachable")));

        writer.writeAll(List.of(entry), callerOf(NAMED_KEY)).block();

        assertThat(output).contains("Audit events not stored: ")
                .contains("\"action\":\"auth.access.refuse\"")
                .doesNotContain("Audit event not recorded");
    }

    @Test
    void writeOnce_entryWithoutOutcome_throws() {
        AuditEntry entry = AuditEntry.builder().action(API_KEY_RATE_LIMIT_REFUSE).build();

        assertThatThrownBy(() -> writer.writeOnce(entry, callerOf(NAMED_KEY), RATE_LIMITED_PATH, ONE_MINUTE))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("An audit entry needs an outcome");
    }

    @Test
    void writeOnce_auditDisabled_recordsNothing() {
        writerWith(false)
                .writeOnce(entry(API_KEY_RATE_LIMIT_REFUSE), callerOf(NAMED_KEY), RATE_LIMITED_PATH, ONE_MINUTE)
                .block();

        verifyNoInteractions(auditOnceRepository, auditEventMapper);
    }

    @Test
    void writeOnce_firstWithinWindow_storesEvent() {
        AuditEntry entry = entry(API_KEY_RATE_LIMIT_REFUSE);
        when(auditOnceRepository.claim(RATE_LIMIT_CLAIM, ONE_MINUTE, SERVED_TENANT)).thenReturn(Mono.just(true));
        stored(entry, NAMED_KEY, SERVED_TENANT);

        writer.writeOnce(entry, callerOf(NAMED_KEY), RATE_LIMITED_PATH, ONE_MINUTE).block();

        assertThat(insertedEvents()).extracting(AuditEvent::getAction).containsExactly("api_key.rate_limit.refuse");
    }

    @Test
    void writeOnce_claimedByAnotherPod_recordsNothing() {
        when(auditOnceRepository.claim(RATE_LIMIT_CLAIM, ONE_MINUTE, SERVED_TENANT)).thenReturn(Mono.just(false));

        writer.writeOnce(entry(API_KEY_RATE_LIMIT_REFUSE), callerOf(NAMED_KEY), RATE_LIMITED_PATH, ONE_MINUTE).block();

        verifyNoInteractions(auditEventRepository);
    }

    @Test
    void writeOnce_sameSessionInAnotherTenant_recordsAgain() {
        AuditActor staff = new AuditActor(STAFF, "staff-1", "Sam Rivera", "sam@flamingo.test", List.of("ADMIN"),
                "platform", null, null);
        AuditEntry entry = AuditEntry.builder().action(STAFF_TENANT_ACCESS_START).outcome(SUCCESS).build();
        Duration refreshTokenLife = Duration.ofDays(7);
        String claim = "staff.tenant_access.start:session-1:staff-1";
        when(tenantResolver.superTenantId()).thenReturn("platform");
        when(auditOnceRepository.claim(claim, refreshTokenLife, "tenant-a")).thenReturn(Mono.just(true));
        when(auditOnceRepository.claim(claim, refreshTokenLife, "tenant-b")).thenReturn(Mono.just(true));
        stored(entry, staff, "tenant-a");
        stored(entry, staff, "tenant-b");

        writer.writeOnce(entry, Mono.just(new AuditCaller(staff, REQUEST_INFO, "tenant-a")), "session-1",
                refreshTokenLife).block();
        writer.writeOnce(entry, Mono.just(new AuditCaller(staff, REQUEST_INFO, "tenant-b")), "session-1",
                refreshTokenLife).block();

        verify(auditEventRepository, times(2)).insert(inserted.capture());
        assertThat(inserted.getAllValues()).extracting(events -> events.getFirst().getTenantId())
                .containsExactly("tenant-a", "tenant-b");
    }

    @Test
    void writeOnce_dedupeStoreUnreachable_storesEventAndLogsFailure(CapturedOutput output) {
        AuditEntry entry = entry(API_KEY_RATE_LIMIT_REFUSE);
        when(auditOnceRepository.claim(RATE_LIMIT_CLAIM, ONE_MINUTE, SERVED_TENANT))
                .thenReturn(Mono.error(new RedisConnectionFailureException("Redis unreachable")));
        stored(entry, NAMED_KEY, SERVED_TENANT);

        writer.writeOnce(entry, callerOf(NAMED_KEY), RATE_LIMITED_PATH, ONE_MINUTE).block();

        assertThat(insertedEvents()).extracting(AuditEvent::getAction).containsExactly("api_key.rate_limit.refuse");
        assertThat(output).contains("Audit dedupe lookup failed, the event is recorded");
    }

    @Test
    void writeOnce_callerFails_completesAndLogsFailure(CapturedOutput output) {
        writer.writeOnce(entry(API_KEY_RATE_LIMIT_REFUSE),
                Mono.error(new IllegalArgumentException("Unsupported roles claim")), RATE_LIMITED_PATH, ONE_MINUTE)
                .block();

        assertThat(output).contains("Audit event not recorded for api_key.rate_limit.refuse");
    }

    private ReactiveAuditEventWriter writerWith(boolean enabled) {
        return new ReactiveAuditEventWriter(auditEventRepository, userRepository, machineRepository,
                auditOnceRepository, auditEventMapper, tenantResolver, auditClock, new JsonMapper(), enabled);
    }

    private AuditEvent mapped(AuditEntry entry, AuditActor actor, String tenantId) {
        AuditEvent event = AuditEvent.builder().action(entry.getAction().getName()).tenantId(tenantId).build();
        when(auditClock.now()).thenReturn(NOW);
        when(auditEventMapper.toEvent(entry, actor, REQUEST_INFO, tenantId, null, NOW)).thenReturn(event);
        return event;
    }

    private void stored(AuditEntry entry, AuditActor actor, String tenantId) {
        AuditEvent event = mapped(entry, actor, tenantId);
        when(auditEventRepository.insert(List.of(event))).thenReturn(Flux.just(event));
    }

    private List<AuditEvent> insertedEvents() {
        verify(auditEventRepository).insert(inserted.capture());
        return inserted.getValue();
    }

    private static Mono<AuditCaller> callerOf(AuditActor actor) {
        return Mono.just(new AuditCaller(actor, REQUEST_INFO, SERVED_TENANT));
    }

    private static AuditEntry entry(AuditAction action) {
        return AuditEntry.builder().action(action).outcome(REFUSED).build();
    }

    private static AuditActor person(AuditActorType type, String id) {
        return new AuditActor(type, id, null, null, List.of(), null, null, null);
    }

    private static User user(String firstName, String lastName) {
        return User.builder().firstName(firstName).lastName(lastName).build();
    }

    private static Machine laptop() {
        Machine machine = new Machine();
        machine.setHostname("LAPTOP-7F3A");
        return machine;
    }
}
