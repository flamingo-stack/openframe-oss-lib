package com.openframe.api.service.rmm;

import com.openframe.api.dto.script.ScriptFilterInput;
import com.openframe.api.dto.script.ScriptFilters;
import com.openframe.data.document.rmm.filter.ScriptQueryFilter;
import com.openframe.data.repository.rmm.ScriptRepository;
import com.openframe.data.service.TenantIdProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Map;

/**
 * Faceted filter options for the scripts list "Shell / OS / Added by" dropdowns —
 * the Script counterpart of {@code DeviceFilterService}.
 *
 * <p>Each facet is computed over the tenant's scripts with the OTHER active filters
 * applied (but not its own field), so a dropdown always offers the full switchable set
 * with live counts; {@code filteredCount} reflects ALL active filters. Option building
 * (incl. author-id → display-name resolution) is delegated to {@link ScriptFilterOptionMapper}.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ScriptFilterService {

    private final ScriptRepository scriptRepository;
    private final ScriptFilterOptionMapper optionMapper;
    private final TenantIdProvider tenantIdProvider;

    public ScriptFilters getScriptFilters(ScriptFilterInput input) {
        String tenantId = tenantIdProvider.getTenantId();
        ScriptQueryFilter filter = toQueryFilter(input);

        Map<String, Integer> shells = scriptRepository.shellFacet(tenantId, filter);
        Map<String, Integer> platforms = scriptRepository.platformFacet(tenantId, filter);
        Map<String, Integer> authors = scriptRepository.authorFacet(tenantId, filter);
        long filteredCount = scriptRepository.countForTenant(tenantId, filter, null);

        return ScriptFilters.builder()
                .shells(optionMapper.selfLabeled(shells))
                .platforms(optionMapper.selfLabeled(platforms))
                .authors(optionMapper.userLabeled(authors))
                .filteredCount((int) filteredCount)
                .build();
    }

    private static ScriptQueryFilter toQueryFilter(ScriptFilterInput input) {
        if (input == null) {
            return null;
        }
        return ScriptQueryFilter.builder()
                .shells(input.getShells())
                .statuses(input.getStatuses())
                .supportedPlatforms(input.getSupportedPlatforms())
                .tagIds(input.getTagIds())
                .createdByIds(input.getAuthorIds())
                .build();
    }
}
