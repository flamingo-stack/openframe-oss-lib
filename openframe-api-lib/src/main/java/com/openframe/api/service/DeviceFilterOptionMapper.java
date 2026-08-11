package com.openframe.api.service;

import com.openframe.api.dto.device.DeviceFilterOption;
import com.openframe.api.dto.device.TagFilterOption;
import com.openframe.data.document.organization.Organization;
import com.openframe.data.repository.organization.OrganizationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class DeviceFilterOptionMapper {

    private final OrganizationRepository organizationRepository;

    public List<DeviceFilterOption> selfLabeled(Map<String, Integer> counts) {
        if (counts == null || counts.isEmpty()) {
            return List.of();
        }
        return counts.entrySet().stream()
                .map(e -> DeviceFilterOption.builder()
                        .value(e.getKey()).label(e.getKey()).count(e.getValue()).build())
                .collect(Collectors.toList());
    }

    public List<DeviceFilterOption> organizationLabeled(Map<String, Integer> counts) {
        if (counts == null || counts.isEmpty()) {
            return List.of();
        }
        Map<String, String> names = organizationRepository.findByOrganizationIdIn(counts.keySet()).stream()
                .collect(Collectors.toMap(Organization::getOrganizationId, Organization::getName));
        return counts.entrySet().stream()
                .map(e -> DeviceFilterOption.builder()
                        .value(e.getKey())
                        .label(names.getOrDefault(e.getKey(), e.getKey()))
                        .count(e.getValue())
                        .build())
                .collect(Collectors.toList());
    }

    public List<TagFilterOption> tagLabeled(Map<String, Integer> counts) {
        if (counts == null || counts.isEmpty()) {
            return List.of();
        }
        return counts.entrySet().stream()
                .map(e -> {
                    String keyValue = e.getKey();
                    int colon = keyValue.indexOf(':');
                    String key = colon >= 0 ? keyValue.substring(0, colon) : keyValue;
                    String value = colon >= 0 ? keyValue.substring(colon + 1) : keyValue;
                    return TagFilterOption.builder().key(key).value(value).count(e.getValue()).build();
                })
                .collect(Collectors.toList());
    }
}
