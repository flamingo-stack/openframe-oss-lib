package com.openframe.api.service.rmm;

import com.openframe.api.dto.script.ScriptFilterInput;
import com.openframe.api.dto.script.ScriptFilterOption;
import com.openframe.api.dto.script.ScriptFilters;
import com.openframe.data.document.rmm.ScriptPlatform;
import com.openframe.data.document.rmm.ScriptShell;
import com.openframe.data.document.rmm.ScriptStatus;
import com.openframe.data.document.rmm.filter.ScriptQueryFilter;
import com.openframe.data.document.user.User;
import com.openframe.data.repository.rmm.ScriptRepository;
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
class ScriptFilterServiceTest {

    private static final String TENANT_ID = "t-1";

    @Mock
    private ScriptRepository scriptRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private TenantIdProvider tenantIdProvider;

    private ScriptFilterService service;

    @BeforeEach
    void setUp() {
        // Real option mapper over the mocked UserRepository so label resolution is exercised end-to-end.
        service = new ScriptFilterService(scriptRepository, new ScriptFilterOptionMapper(userRepository), tenantIdProvider);
    }

    @Test
    @DisplayName("getScriptFilters: shells/platforms are self-labeled, authors resolved to display names (full name → email), filteredCount passed through")
    void getScriptFilters_buildsAllFacets() {
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(scriptRepository.shellFacet(eq(TENANT_ID), any())).thenReturn(Map.of("BASH", 3, "POWERSHELL", 1));
        when(scriptRepository.platformFacet(eq(TENANT_ID), any())).thenReturn(Map.of("LINUX", 2));
        when(scriptRepository.authorFacet(eq(TENANT_ID), any())).thenReturn(Map.of("u-1", 4, "u-2", 1));
        when(scriptRepository.countForTenant(eq(TENANT_ID), any(), isNull())).thenReturn(5L);
        when(userRepository.findAllById(any())).thenReturn(List.of(
                user("u-1", "Neo", "Anderson", "neo@example.com"),
                user("u-2", null, null, "trinity@example.com")));   // no name → email label

        ScriptFilters result = service.getScriptFilters(ScriptFilterInput.builder().build());

        assertThat(result.getFilteredCount()).isEqualTo(5);
        assertThat(result.getShells())
                .extracting(ScriptFilterOption::getValue).containsExactlyInAnyOrder("BASH", "POWERSHELL");
        assertThat(result.getShells()).allSatisfy(o -> assertThat(o.getLabel()).isEqualTo(o.getValue()));  // self-labeled
        assertThat(result.getPlatforms()).singleElement().satisfies(o -> {
            assertThat(o.getValue()).isEqualTo("LINUX");
            assertThat(o.getCount()).isEqualTo(2);
        });
        assertThat(result.getAuthors())
                .anySatisfy(o -> {
                    assertThat(o.getValue()).isEqualTo("u-1");
                    assertThat(o.getLabel()).isEqualTo("Neo Anderson");
                    assertThat(o.getCount()).isEqualTo(4);
                })
                .anySatisfy(o -> {
                    assertThat(o.getValue()).isEqualTo("u-2");
                    assertThat(o.getLabel()).isEqualTo("trinity@example.com");
                });
    }

    @Test
    @DisplayName("getScriptFilters: no authors → empty authors list and NO user lookup")
    void getScriptFilters_noAuthors_skipsUserLookup() {
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(scriptRepository.shellFacet(eq(TENANT_ID), any())).thenReturn(Map.of());
        when(scriptRepository.platformFacet(eq(TENANT_ID), any())).thenReturn(Map.of());
        when(scriptRepository.authorFacet(eq(TENANT_ID), any())).thenReturn(Map.of());
        when(scriptRepository.countForTenant(eq(TENANT_ID), any(), isNull())).thenReturn(0L);

        ScriptFilters result = service.getScriptFilters(ScriptFilterInput.builder().build());

        assertThat(result.getAuthors()).isEmpty();
        verifyNoInteractions(userRepository);
    }

    @Test
    @DisplayName("getScriptFilters: maps the API input (authorIds → createdByIds, shells/statuses/platforms/tagIds) into the data-layer ScriptQueryFilter handed to every facet AND the count")
    void getScriptFilters_mapsInputToQueryFilter() {
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(scriptRepository.shellFacet(eq(TENANT_ID), any())).thenReturn(Map.of());
        when(scriptRepository.platformFacet(eq(TENANT_ID), any())).thenReturn(Map.of());
        when(scriptRepository.authorFacet(eq(TENANT_ID), any())).thenReturn(Map.of());
        when(scriptRepository.countForTenant(eq(TENANT_ID), any(), isNull())).thenReturn(0L);

        ScriptFilterInput input = ScriptFilterInput.builder()
                .shells(List.of(ScriptShell.BASH))
                .statuses(List.of(ScriptStatus.ACTIVE))
                .supportedPlatforms(List.of(ScriptPlatform.LINUX))
                .tagIds(List.of("tag-1"))
                .authorIds(List.of("user-7"))
                .build();

        service.getScriptFilters(input);

        ArgumentCaptor<ScriptQueryFilter> captor = ArgumentCaptor.forClass(ScriptQueryFilter.class);
        verify(scriptRepository).shellFacet(eq(TENANT_ID), captor.capture());
        ScriptQueryFilter qf = captor.getValue();
        assertThat(qf.getCreatedByIds()).containsExactly("user-7");          // authorIds → createdByIds
        assertThat(qf.getShells()).containsExactly(ScriptShell.BASH);
        assertThat(qf.getStatuses()).containsExactly(ScriptStatus.ACTIVE);
        assertThat(qf.getSupportedPlatforms()).containsExactly(ScriptPlatform.LINUX);
        assertThat(qf.getTagIds()).containsExactly("tag-1");

        // the same mapped filter reaches the count (with search == null)
        verify(scriptRepository).countForTenant(eq(TENANT_ID), eq(qf), isNull());
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
