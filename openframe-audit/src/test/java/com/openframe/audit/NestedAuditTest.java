package com.openframe.audit;

import com.openframe.audit.targets.AuditTarget;
import com.openframe.audit.targets.AuditTargetRegistry;
import com.openframe.audit.targets.AuditTargetRepository;
import com.openframe.audit.targets.LoadedTarget;
import com.openframe.data.document.audit.AuditEvent;
import com.openframe.data.document.audit.AuditOutcome;
import com.openframe.data.document.audit.AuditTargetType;
import com.openframe.data.document.ticket.Ticket;
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
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.data.mongodb.core.convert.MappingMongoConverter;
import org.springframework.data.mongodb.core.convert.MongoConverter;
import org.springframework.data.mongodb.core.convert.MongoCustomConversions;
import org.springframework.data.mongodb.core.convert.NoOpDbRefResolver;
import org.springframework.data.mongodb.core.mapping.MongoMappingContext;
import tools.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static com.openframe.data.document.audit.AuditAction.TICKET_ARCHIVE;
import static com.openframe.data.document.audit.AuditAction.TICKET_TAG_ADD;
import static com.openframe.data.document.audit.AuditAction.TICKET_UPDATE;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NestedAuditTest {

    private static final AuditTarget<Ticket> TICKETS =
            AuditTarget.of(AuditTargetType.TICKET, Ticket.class, Ticket::getTitle);
    private static final List<AuditTarget<?>> TICKET_TARGETS = List.of(TICKETS);
    private static final ActionOutcome SUCCEEDED = new ActionOutcome(AuditOutcome.SUCCESS, null);

    @Mock private AuditEventRepository auditEventRepository;
    @Mock private UserRepository userRepository;
    @Mock private MachineRepository machineRepository;
    @Mock private ApiKeyRepository apiKeyRepository;
    @Mock private AuditTargetRepository targetRepository;
    @Mock private AuditTenantResolver tenantResolver;
    @Mock private AuditOutcomeResolver outcomeResolver;
    @Mock private AuditClock auditClock;
    @Captor private ArgumentCaptor<List<AuditEvent>> savedCaptor;

    private AuditRecorder recorder;
    private AuditedMethodRunner runner;

    @BeforeEach
    void setUp() {
        AuditTargetRegistry targets = new AuditTargetRegistry(List.of(() -> TICKET_TARGETS));
        AuditEventWriter writer = new AuditEventWriter(auditEventRepository, userRepository, machineRepository,
                targetRepository, tenantResolver, targets, new AuditEventMapperImpl(), new ObjectMapper(), auditClock);
        recorder = new AuditRecorder(apiKeyRepository, tenantResolver, outcomeResolver, writer, auditClock, true);
        runner = new AuditedMethodRunner(targets, targetRepository, outcomeResolver, recorder, writer,
                new AuditDocumentConverter(mongoConverter()), true);
    }

    @Test
    void run_workRunsAnotherAuditedWork_savesTheInnerEventAsAChildOfTheOuterOne() {
        ticketsNotStored("ticket-1");
        succeedsWithoutAResult();
        savesEvents();

        runner.run(TICKET_UPDATE, "ticket-1", () -> runner.run(TICKET_TAG_ADD, "ticket-1", () -> { }));

        List<AuditEvent> saved = savedEvents(2);
        AuditEvent inner = saved.getFirst();
        AuditEvent outer = saved.getLast();
        assertThat(inner.getAction()).isEqualTo("ticket.tag.add");
        assertThat(outer.getAction()).isEqualTo("ticket.update");
        assertThat(inner.getParentEventId()).isEqualTo(outer.getId());
        assertThat(outer.getParentEventId()).isNull();
    }

    @Test
    void run_twoInnerWorksOneAfterAnother_hangsBothUnderTheOuterOne() {
        ticketsNotStored("ticket-1");
        succeedsWithoutAResult();
        savesEvents();

        runner.run(TICKET_UPDATE, "ticket-1", () -> {
            runner.run(TICKET_TAG_ADD, "ticket-1", () -> { });
            runner.run(TICKET_ARCHIVE, "ticket-1", () -> { });
        });

        List<AuditEvent> saved = savedEvents(3);
        AuditEvent outer = saved.getLast();
        assertThat(saved.getFirst().getParentEventId()).isEqualTo(outer.getId());
        assertThat(saved.get(1).getParentEventId()).isEqualTo(outer.getId());
    }

    @Test
    void run_innerWorkThrows_savesBothAsFailedAndLeavesTheThreadClean() {
        IllegalStateException failure = new IllegalStateException("boom");
        ticketsNotStored("ticket-1");
        when(outcomeResolver.ofFailure(failure)).thenReturn(new ActionOutcome(AuditOutcome.FAILURE, "boom"));
        savesEvents();

        assertThatThrownBy(() -> runner.run(TICKET_UPDATE, "ticket-1", () ->
                runner.run(TICKET_TAG_ADD, "ticket-1", () -> {
                    throw failure;
                }))).isSameAs(failure);

        List<AuditEvent> saved = savedEvents(2);
        AuditEvent inner = saved.getFirst();
        AuditEvent outer = saved.getLast();
        assertThat(inner.getOutcome()).isEqualTo(AuditOutcome.FAILURE);
        assertThat(outer.getOutcome()).isEqualTo(AuditOutcome.FAILURE);
        assertThat(inner.getParentEventId()).isEqualTo(outer.getId());
        assertThat(runner.alreadyRecorded(failure)).isTrue();
        assertThat(recorder.parentEventId()).isNull();
    }

    @Test
    void run_workEnds_theNextWorkOnTheThreadStartsWithNoParent() {
        ticketsNotStored("ticket-1");
        ticketsNotStored("ticket-2");
        succeedsWithoutAResult();
        savesEvents();

        runner.run(TICKET_UPDATE, "ticket-1", () -> { });
        runner.run(TICKET_ARCHIVE, "ticket-2", () -> { });

        List<AuditEvent> saved = savedEvents(2);
        assertThat(saved.getFirst().getParentEventId()).isNull();
        assertThat(saved.getLast().getParentEventId()).isNull();
        assertThat(recorder.parentEventId()).isNull();
    }

    @Test
    void run_updateChangedNothingButAnInnerEventWasSaved_savesTheUpdateAsItsParent() {
        ticketStored();
        succeedsWithoutAResult();
        savesEvents();

        runner.run(TICKET_UPDATE, "ticket-1", this::addsATag);

        List<AuditEvent> saved = savedEvents(2);
        assertThat(saved.getLast().getAction()).isEqualTo("ticket.update");
        assertThat(saved.getFirst().getParentEventId()).isEqualTo(saved.getLast().getId());
    }

    @Test
    void run_updateChangedNothingAndTheInnerEventWasNotStored_doesNotSaveTheUpdate() {
        ticketStored();
        succeedsWithoutAResult();
        savesEvents();
        when(auditEventRepository.insert(anyList()))
                .thenThrow(new DataAccessResourceFailureException("Mongo primary unavailable"));

        runner.run(TICKET_UPDATE, "ticket-1", this::addsATag);

        assertThat(savedEvents(1).getFirst().getAction()).isEqualTo("ticket.tag.add");
    }

    private void addsATag() {
        runner.runWithoutCompare(TICKET_TAG_ADD, AuditTargetType.TICKET, "ticket-1", Map.of("tagId", "tag-1"),
                () -> { });
    }

    private void ticketStored() {
        Ticket ticket = new Ticket();
        ticket.setTitle("Printer offline");
        when(targetRepository.load(TICKET_TARGETS, "ticket-1"))
                .thenReturn(Optional.of(new LoadedTarget(TICKETS, ticket)));
    }

    private void ticketsNotStored(String ticketId) {
        when(targetRepository.load(TICKET_TARGETS, ticketId)).thenReturn(Optional.empty());
    }

    private void succeedsWithoutAResult() {
        when(outcomeResolver.ofResult(null)).thenReturn(SUCCEEDED);
    }

    private void savesEvents() {
        when(auditClock.now()).thenReturn(Instant.parse("2026-11-12T10:00:00Z"));
    }

    private static MongoConverter mongoConverter() {
        MongoCustomConversions conversions = new MongoCustomConversions(List.of());
        MongoMappingContext mappingContext = new MongoMappingContext();
        mappingContext.setSimpleTypeHolder(conversions.getSimpleTypeHolder());
        MappingMongoConverter converter = new MappingMongoConverter(NoOpDbRefResolver.INSTANCE, mappingContext);
        converter.setCustomConversions(conversions);
        converter.afterPropertiesSet();
        return converter;
    }

    private List<AuditEvent> savedEvents(int count) {
        verify(auditEventRepository, times(count)).insert(savedCaptor.capture());
        return savedCaptor.getAllValues().stream().map(List::getFirst).toList();
    }
}
