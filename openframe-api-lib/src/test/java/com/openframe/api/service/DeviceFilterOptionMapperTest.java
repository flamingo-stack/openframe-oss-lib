package com.openframe.api.service;

import com.openframe.api.dto.device.DeviceFilterOption;
import com.openframe.data.document.organization.Organization;
import com.openframe.data.repository.organization.OrganizationRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.ArgumentMatchers.anySet;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeviceFilterOptionMapperTest {

    @Mock private OrganizationRepository organizationRepository;

    private DeviceFilterOptionMapper mapper() {
        return new DeviceFilterOptionMapper(organizationRepository);
    }

    @Test
    void selfLabeled_usesRawKeyAsValueAndLabel() {
        Map<String, Integer> counts = new LinkedHashMap<>();
        counts.put("ONLINE", 3);
        counts.put("OFFLINE", 1);

        List<DeviceFilterOption> options = mapper().selfLabeled(counts);

        assertThat(options)
                .extracting(DeviceFilterOption::getValue, DeviceFilterOption::getLabel, DeviceFilterOption::getCount)
                .containsExactly(tuple("ONLINE", "ONLINE", 3), tuple("OFFLINE", "OFFLINE", 1));
    }

    @Test
    void selfLabeled_emptyOrNull_yieldsEmptyList_withoutHittingRepo() {
        assertThat(mapper().selfLabeled(null)).isEmpty();
        assertThat(mapper().selfLabeled(Map.of())).isEmpty();
        verifyNoInteractions(organizationRepository);
    }

    @Test
    void organizationLabeled_resolvesNamesAndFallsBackToIdWhenUnknown() {
        Map<String, Integer> counts = new LinkedHashMap<>();
        counts.put("org-1", 5);
        counts.put("org-2", 2);   // no matching Organization → label falls back to the id
        when(organizationRepository.findByOrganizationIdIn(anySet()))
                .thenReturn(List.of(org("org-1", "Acme Inc")));

        List<DeviceFilterOption> options = mapper().organizationLabeled(counts);

        assertThat(options)
                .extracting(DeviceFilterOption::getValue, DeviceFilterOption::getLabel, DeviceFilterOption::getCount)
                .containsExactlyInAnyOrder(
                        tuple("org-1", "Acme Inc", 5),
                        tuple("org-2", "org-2", 2));
    }

    @Test
    void organizationLabeled_empty_yieldsEmptyList_withoutHittingRepo() {
        assertThat(mapper().organizationLabeled(Map.of())).isEmpty();
        verifyNoInteractions(organizationRepository);
    }

    private static Organization org(String id, String name) {
        Organization o = new Organization();
        o.setOrganizationId(id);
        o.setName(name);
        return o;
    }
}
