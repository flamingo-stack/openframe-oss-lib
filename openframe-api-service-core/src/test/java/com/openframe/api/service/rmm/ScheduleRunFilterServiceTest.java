package com.openframe.api.service.rmm;

import com.openframe.api.dto.rmm.schedulerun.ScheduleRunFilterInput;
import com.openframe.api.dto.rmm.schedulerun.ScheduleRunFilters;
import com.openframe.api.dto.rmm.script.ScriptFilterOption;
import com.openframe.api.mapper.ScriptFilterOptionMapper;
import com.openframe.api.service.rmm.schedule.ScheduleRunFilterService;
import com.openframe.data.document.rmm.script.ExecutionStatus;
import com.openframe.data.document.rmm.filter.ScheduleRunQueryFilter;
import com.openframe.data.document.user.User;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.rmm.ScheduleScriptExecutionRepository;
import com.openframe.data.repository.user.UserRepository;
import com.openframe.data.service.TenantIdProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ScheduleRunFilterServiceTest {

    private static final String TENANT_ID = "t-1";
    private static final String SCHEDULE_ID = "sch-1";
    private static final String FIELD_STATUS = "status";
    private static final String FIELD_INITIATED_BY = "initiatedBy";

    @Mock
    private ScheduleScriptExecutionRepository repository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private MachineRepository machineRepository;
    @Mock
    private TenantIdProvider tenantIdProvider;

    private ScheduleRunFilterService service;

    @BeforeEach
    void setUp() {
        // Real option mapper over the mocked repositories so label resolution is exercised end-to-end.
        service = new ScheduleRunFilterService(
                repository,
                new ScriptFilterOptionMapper(userRepository, machineRepository),
                tenantIdProvider);
    }

    @Test
    @DisplayName("getScheduleRunFilters: status facet is self-labeled, initiators are user-labeled, filteredCount is passed through")
    void getScheduleRunFilters_buildsStatusAndInitiatorOptions() {
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(repository.facet(eq(TENANT_ID), eq(SCHEDULE_ID), any(), isNull(), eq(FIELD_STATUS)))
                .thenReturn(Map.of("SUCCESS", 5, "FAILED", 2));
        when(repository.facet(eq(TENANT_ID), eq(SCHEDULE_ID), any(), isNull(), eq(FIELD_INITIATED_BY)))
                .thenReturn(Map.of("u-1", 3, "u-2", 1));
        when(repository.countForSchedule(eq(TENANT_ID), eq(SCHEDULE_ID), any(), isNull())).thenReturn(7L);
        when(userRepository.findAllById(any())).thenReturn(List.of(
                user("u-1", "Alice", "Smith", "alice@example.com"),
                user("u-2", null, null, "bob@example.com")));   // no name → email label

        ScheduleRunFilters result = service.getScheduleRunFilters(SCHEDULE_ID, ScheduleRunFilterInput.builder().build(), null);

        assertThat(result.getFilteredCount()).isEqualTo(7);
        assertThat(result.getStatuses())
                .extracting(ScriptFilterOption::getValue).containsExactlyInAnyOrder("SUCCESS", "FAILED");
        assertThat(result.getStatuses()).allSatisfy(o -> assertThat(o.getLabel()).isEqualTo(o.getValue()));  // self-labeled
        assertThat(result.getInitiators())
                .anySatisfy(o -> {
                    assertThat(o.getValue()).isEqualTo("u-1");
                    assertThat(o.getLabel()).isEqualTo("Alice Smith");
                    assertThat(o.getCount()).isEqualTo(3);
                })
                .anySatisfy(o -> {
                    assertThat(o.getValue()).isEqualTo("u-2");
                    assertThat(o.getLabel()).isEqualTo("bob@example.com");   // no name → email
                })
                .extracting(ScriptFilterOption::getValue).containsExactlyInAnyOrder("u-1", "u-2");
    }

    @Test
    @DisplayName("getScheduleRunFilters: no initiators → empty list and NO user lookup")
    void getScheduleRunFilters_noInitiators_skipsUserLookup() {
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(repository.facet(eq(TENANT_ID), eq(SCHEDULE_ID), any(), isNull(), eq(FIELD_STATUS))).thenReturn(Map.of());
        when(repository.facet(eq(TENANT_ID), eq(SCHEDULE_ID), any(), isNull(), eq(FIELD_INITIATED_BY))).thenReturn(Map.of());
        when(repository.countForSchedule(eq(TENANT_ID), eq(SCHEDULE_ID), any(), isNull())).thenReturn(0L);

        ScheduleRunFilters result = service.getScheduleRunFilters(SCHEDULE_ID, ScheduleRunFilterInput.builder().build(), null);

        assertThat(result.getInitiators()).isEmpty();
        assertThat(result.getStatuses()).isEmpty();
        verifyNoInteractions(userRepository);
    }

    @Test
    @DisplayName("getScheduleRunFilters: maps the API filter (statuses + dispatchedAt range) into the query filter and forwards scheduleId + search to every facet and the count")
    void getScheduleRunFilters_mapsInputAndForwardsScheduleIdSearch() {
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(repository.facet(eq(TENANT_ID), eq(SCHEDULE_ID), any(), eq("web"), eq(FIELD_STATUS))).thenReturn(Map.of());
        when(repository.facet(eq(TENANT_ID), eq(SCHEDULE_ID), any(), eq("web"), eq(FIELD_INITIATED_BY))).thenReturn(Map.of());
        when(repository.countForSchedule(eq(TENANT_ID), eq(SCHEDULE_ID), any(), eq("web"))).thenReturn(0L);

        Instant from = Instant.parse("2026-01-01T00:00:00Z");
        Instant to = Instant.parse("2026-01-31T00:00:00Z");
        ScheduleRunFilterInput input = ScheduleRunFilterInput.builder()
                .statuses(List.of(ExecutionStatus.SUCCESS))
                .dispatchedAtFrom(from)
                .dispatchedAtTo(to)
                .build();

        service.getScheduleRunFilters(SCHEDULE_ID, input, "web");

        ArgumentCaptor<ScheduleRunQueryFilter> captor = ArgumentCaptor.forClass(ScheduleRunQueryFilter.class);
        verify(repository).facet(eq(TENANT_ID), eq(SCHEDULE_ID), captor.capture(), eq("web"), eq(FIELD_STATUS));
        ScheduleRunQueryFilter qf = captor.getValue();
        assertThat(qf.getStatuses()).containsExactly(ExecutionStatus.SUCCESS);
        assertThat(qf.getDispatchedAtFrom()).isEqualTo(from);
        assertThat(qf.getDispatchedAtTo()).isEqualTo(to);

        // same mapped filter + same search reach the count
        verify(repository).countForSchedule(eq(TENANT_ID), eq(SCHEDULE_ID), eq(qf), eq("web"));
    }

    private static User user(String id, String first, String last, String email) {
        User u = new User();
        u.setId(id);
        u.setFirstName(first);
        u.setLastName(last);
        u.setEmail(email);
        return u;
    }
}
