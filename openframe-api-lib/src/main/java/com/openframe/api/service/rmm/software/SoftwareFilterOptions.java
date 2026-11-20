package com.openframe.api.service.rmm.software;

import com.openframe.api.dto.rmm.software.SoftwareFilterOption;
import com.openframe.data.document.organization.Organization;
import com.openframe.data.repository.organization.OrganizationRepository;

import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;

final class SoftwareFilterOptions {

    private SoftwareFilterOptions() {
    }

    static <T, E extends Enum<E>> List<SoftwareFilterOption> enumFacet(List<T> rows, Function<T, E> dimension) {
        Map<E, Long> counts = rows.stream()
                .map(dimension)
                .filter(Objects::nonNull)
                .collect(Collectors.groupingBy(Function.identity(), Collectors.counting()));
        return counts.entrySet().stream()
                .sorted(Comparator.comparingInt(e -> e.getKey().ordinal()))
                .map(e -> SoftwareFilterOption.builder()
                        .value(e.getKey().name())
                        .label(label(e.getKey()))
                        .count(e.getValue().intValue())
                        .build())
                .toList();
    }

    static List<SoftwareFilterOption> organizations(Stream<String> organizationIds,
                                                    OrganizationRepository organizationRepository) {
        Map<String, Long> counts = organizationIds
                .filter(Objects::nonNull)
                .collect(Collectors.groupingBy(Function.identity(), Collectors.counting()));
        if (counts.isEmpty()) {
            return List.of();
        }
        Map<String, String> names = organizationRepository.findByOrganizationIdIn(counts.keySet()).stream()
                .filter(organization -> organization.getName() != null)
                .collect(Collectors.toMap(Organization::getOrganizationId, Organization::getName, (a, b) -> a));
        return counts.entrySet().stream()
                .map(e -> SoftwareFilterOption.builder()
                        .value(e.getKey())
                        .label(names.getOrDefault(e.getKey(), e.getKey()))
                        .count(e.getValue().intValue())
                        .build())
                .sorted(Comparator.comparing(SoftwareFilterOption::getLabel, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    static String label(Enum<?> value) {
        String lower = value.name().toLowerCase(Locale.ROOT).replace('_', ' ');
        return lower.isEmpty() ? lower : Character.toUpperCase(lower.charAt(0)) + lower.substring(1);
    }
}
