package com.openframe.audit;

import com.openframe.audit.targets.AuditTargetRegistry;
import com.openframe.audit.targets.AuditTargetRepository;
import com.openframe.data.document.audit.AuditEvent;
import com.openframe.data.document.audit.AuditOutcome;
import com.openframe.data.mapper.AuditEventMapperImpl;
import com.openframe.data.repository.apikey.ApiKeyRepository;
import com.openframe.data.repository.audit.AuditEventRepository;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.user.UserRepository;
import com.openframe.data.service.AuditClock;
import com.openframe.data.service.AuditTenantResolver;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import tools.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;

import static com.openframe.data.document.audit.AuditAction.TICKET_ARCHIVE;
import static com.openframe.data.document.audit.AuditAction.TICKET_TAG_ADD;
import static com.openframe.data.document.audit.AuditAction.TICKET_UPDATE;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class NestedAuditTest {

    @Mock private AuditEventRepository auditEventRepository;
    @Mock private UserRepository userRepository;
    @Mock private MachineRepository machineRepository;
    @Mock private ApiKeyRepository apiKeyRepository;
    @Mock private AuditTargetRepository targetRepository;
    @Mock private AuditTenantResolver tenantResolver;
    @Mock private AuditOutcomeResolver outcomeResolver;
    @Mock private AuditClock auditClock;

    private AuditRecorder recorder;
    private AuditCapture capture;

    @BeforeEach
    void setUp() {
        AuditTargetRegistry targets = new AuditTargetRegistry(List.of());
        recorder = new AuditRecorder(auditEventRepository, userRepository, machineRepository, apiKeyRepository,
                targetRepository, tenantResolver, targets, outcomeResolver, new AuditEventMapperImpl(),
                new ObjectMapper(), auditClock, true);
        capture = new AuditCapture(targets, targetRepository, outcomeResolver, recorder, true);
        when(auditEventRepository.insert(any(AuditEvent.class))).thenAnswer(saved -> saved.getArgument(0));
        when(targetRepository.load(anyList(), anyString())).thenReturn(Optional.empty());
        when(outcomeResolver.ofResult(any())).thenReturn(new ActionOutcome(AuditOutcome.SUCCESS, null));
        when(outcomeResolver.ofFailure(any())).thenReturn(new ActionOutcome(AuditOutcome.FAILURE, "boom"));
        when(auditClock.now()).thenReturn(Instant.parse("2026-11-12T10:00:00Z"));
    }

    @Test
    void run_workRunsAnotherAuditedWork_savesTheInnerEventAsAChildOfTheOuterOne() {
        capture.run(TICKET_UPDATE, "ticket-1", () -> capture.run(TICKET_TAG_ADD, "ticket-1", () -> { }));

        List<AuditEvent> saved = savedEvents(2);
        AuditEvent inner = saved.getFirst();
        AuditEvent outer = saved.getLast();
        assertThat(inner.getAction()).isEqualTo("ticket.tag.add");
        assertThat(outer.getAction()).isEqualTo("ticket.update");
        assertThat(inner.getParentEventId()).isEqualTo(outer.getId());
        assertThat(outer.getParentEventId()).isNull();
    }

    @Test
    void run_threeLevels_hangsEachEventUnderTheOneThatRanIt() {
        capture.run(TICKET_UPDATE, "ticket-1", () ->
                capture.run(TICKET_TAG_ADD, "ticket-1", () ->
                        capture.run(TICKET_ARCHIVE, "ticket-1", () -> { })));

        List<AuditEvent> saved = savedEvents(3);
        AuditEvent innermost = saved.getFirst();
        AuditEvent middle = saved.get(1);
        AuditEvent outer = saved.getLast();
        assertThat(innermost.getParentEventId()).isEqualTo(middle.getId());
        assertThat(middle.getParentEventId()).isEqualTo(outer.getId());
        assertThat(outer.getParentEventId()).isNull();
    }

    @Test
    void run_twoInnerWorksOneAfterAnother_hangsBothUnderTheOuterOne() {
        capture.run(TICKET_UPDATE, "ticket-1", () -> {
            capture.run(TICKET_TAG_ADD, "ticket-1", () -> { });
            capture.run(TICKET_ARCHIVE, "ticket-1", () -> { });
        });

        List<AuditEvent> saved = savedEvents(3);
        AuditEvent outer = saved.getLast();
        assertThat(saved.getFirst().getParentEventId()).isEqualTo(outer.getId());
        assertThat(saved.get(1).getParentEventId()).isEqualTo(outer.getId());
    }

    @Test
    void run_innerWorkEnds_outerWorkSeesItsOwnEventAgain() {
        AtomicReference<String> before = new AtomicReference<>();
        AtomicReference<String> inside = new AtomicReference<>();
        AtomicReference<String> after = new AtomicReference<>();

        capture.run(TICKET_UPDATE, "ticket-1", () -> {
            before.set(recorder.currentEventId());
            capture.run(TICKET_TAG_ADD, "ticket-1", () -> inside.set(recorder.currentEventId()));
            after.set(recorder.currentEventId());
        });

        List<AuditEvent> saved = savedEvents(2);
        assertThat(before.get()).isEqualTo(saved.getLast().getId());
        assertThat(inside.get()).isEqualTo(saved.getFirst().getId());
        assertThat(after.get()).isEqualTo(saved.getLast().getId());
    }

    @Test
    void run_innerWorkThrows_savesBothAsFailedAndLeavesTheThreadClean() {
        IllegalStateException failure = new IllegalStateException("boom");

        assertThatThrownBy(() -> capture.run(TICKET_UPDATE, "ticket-1", () ->
                capture.run(TICKET_TAG_ADD, "ticket-1", () -> {
                    throw failure;
                }))).isSameAs(failure);

        List<AuditEvent> saved = savedEvents(2);
        AuditEvent inner = saved.getFirst();
        AuditEvent outer = saved.getLast();
        assertThat(inner.getOutcome()).isEqualTo(AuditOutcome.FAILURE);
        assertThat(outer.getOutcome()).isEqualTo(AuditOutcome.FAILURE);
        assertThat(inner.getParentEventId()).isEqualTo(outer.getId());
        assertThat(recorder.captured(failure)).isTrue();
        assertThat(recorder.currentEventId()).isNull();
    }

    @Test
    void run_workEnds_theNextWorkOnTheThreadStartsWithNoParent() {
        capture.run(TICKET_UPDATE, "ticket-1", () -> { });
        capture.run(TICKET_ARCHIVE, "ticket-2", () -> { });

        List<AuditEvent> saved = savedEvents(2);
        assertThat(saved.getFirst().getParentEventId()).isNull();
        assertThat(saved.getLast().getParentEventId()).isNull();
        assertThat(recorder.currentEventId()).isNull();
    }

    private List<AuditEvent> savedEvents(int count) {
        ArgumentCaptor<AuditEvent> saved = ArgumentCaptor.forClass(AuditEvent.class);
        verify(auditEventRepository, times(count)).insert(saved.capture());
        return saved.getAllValues();
    }
}
