package com.openframe.api.service.rmm;

import com.openframe.api.dto.execution.ScriptExecutionFilterInput;
import com.openframe.api.dto.execution.ScriptExecutionFilters;
import com.openframe.api.dto.script.ScriptFilterOption;
import com.openframe.data.document.rmm.ScriptExecutionStatus;
import com.openframe.data.document.rmm.filter.ScriptExecutionQueryFilter;
import com.openframe.data.document.user.User;
import com.openframe.data.repository.rmm.ScriptExecutionRepository;
import com.openframe.data.repository.user.UserRepository;
import com.openframe.data.service.TenantIdProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

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
class ScriptExecutionFilterServiceTest {

    private static final String TENANT_ID = "t-1";
    private static final String SCRIPT_ID = "s-1";

    @Mock
    private ScriptExecutionRepository scriptExecutionRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private TenantIdProvider tenantIdProvider;

    private ScriptExecutionFilterService service;

    @BeforeEach
    void setUp() {
        // Real option mapper over the mocked UserRepository so label resolution is exercised end-to-end.
        service = new ScriptExecutionFilterService(
                scriptExecutionRepository, new ScriptFilterOptionMapper(userRepository), tenantIdProvider);
    }

    @Test
    @DisplayName("getExecutionFilters: maps the initiator facet to options with resolved display names and passes filteredCount through")
    void getExecutionFilters_buildsInitiatorOptions() {
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(scriptExecutionRepository.initiatorFacet(eq(TENANT_ID), eq(SCRIPT_ID), any(), isNull()))
                .thenReturn(Map.of("u-1", 3, "u-2", 1));
        when(scriptExecutionRepository.countForScript(eq(TENANT_ID), eq(SCRIPT_ID), any(), isNull())).thenReturn(4L);
        when(userRepository.findAllById(any())).thenReturn(List.of(
                user("u-1", "Alice", "Smith", "alice@example.com"),
                user("u-2", null, null, "bob@example.com")));   // no name → email label

        ScriptExecutionFilters result = service.getExecutionFilters(
                SCRIPT_ID, ScriptExecutionFilterInput.builder().build(), null);

        assertThat(result.getFilteredCount()).isEqualTo(4);
        assertThat(result.getInitiators())
                .anySatisfy(o -> {
                    assertThat(o.getValue()).isEqualTo("u-1");
                    assertThat(o.getLabel()).isEqualTo("Alice Smith");
                    assertThat(o.getCount()).isEqualTo(3);
                })
                .anySatisfy(o -> {
                    assertThat(o.getValue()).isEqualTo("u-2");
                    assertThat(o.getLabel()).isEqualTo("bob@example.com");
                })
                .extracting(ScriptFilterOption::getValue).containsExactlyInAnyOrder("u-1", "u-2");
    }

    @Test
    @DisplayName("getExecutionFilters: no initiators → empty list and NO user lookup")
    void getExecutionFilters_noInitiators_skipsUserLookup() {
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(scriptExecutionRepository.initiatorFacet(eq(TENANT_ID), eq(SCRIPT_ID), any(), isNull())).thenReturn(Map.of());
        when(scriptExecutionRepository.countForScript(eq(TENANT_ID), eq(SCRIPT_ID), any(), isNull())).thenReturn(0L);

        ScriptExecutionFilters result = service.getExecutionFilters(
                SCRIPT_ID, ScriptExecutionFilterInput.builder().build(), null);

        assertThat(result.getInitiators()).isEmpty();
        verifyNoInteractions(userRepository);
    }

    @Test
    @DisplayName("getExecutionFilters: maps the API filter (initiatorIds → initiatedByIds, statuses, machineIds) and forwards scriptId + search to BOTH the initiator facet and the count")
    void getExecutionFilters_mapsInputAndForwardsScriptIdSearch() {
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(scriptExecutionRepository.initiatorFacet(eq(TENANT_ID), eq(SCRIPT_ID), any(), eq("alice"))).thenReturn(Map.of());
        when(scriptExecutionRepository.countForScript(eq(TENANT_ID), eq(SCRIPT_ID), any(), eq("alice"))).thenReturn(0L);

        ScriptExecutionFilterInput input = ScriptExecutionFilterInput.builder()
                .statuses(List.of(ScriptExecutionStatus.SUCCESS))
                .initiatorIds(List.of("u-9"))
                .machineIds(List.of("m-1"))
                .build();

        service.getExecutionFilters(SCRIPT_ID, input, "alice");

        ArgumentCaptor<ScriptExecutionQueryFilter> captor = ArgumentCaptor.forClass(ScriptExecutionQueryFilter.class);
        verify(scriptExecutionRepository).initiatorFacet(eq(TENANT_ID), eq(SCRIPT_ID), captor.capture(), eq("alice"));
        ScriptExecutionQueryFilter qf = captor.getValue();
        assertThat(qf.getInitiatedByIds()).containsExactly("u-9");          // initiatorIds → initiatedByIds
        assertThat(qf.getStatuses()).containsExactly(ScriptExecutionStatus.SUCCESS);
        assertThat(qf.getMachineIds()).containsExactly("m-1");

        // same mapped filter + same search reach the count
        verify(scriptExecutionRepository).countForScript(eq(TENANT_ID), eq(SCRIPT_ID), eq(qf), eq("alice"));
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
