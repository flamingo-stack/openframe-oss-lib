package com.openframe.api.service.rmm;

import com.openframe.api.dto.script.ScriptFilterOption;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.user.User;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.springframework.util.StringUtils.hasText;

/**
 * Builds {@link ScriptFilterOption} lists from facet {@code value → count} maps — shared by
 * {@link ScriptFilterService} and {@link ScriptExecutionFilterService} so the option-building
 * and user-label resolution live in one place.
 */
@Component
@RequiredArgsConstructor
public class ScriptFilterOptionMapper {

    private final UserRepository userRepository;
    private final MachineRepository machineRepository;

    /** Enum-valued facets (shell/platform/status): {@code value == label == } the raw key. */
    public List<ScriptFilterOption> selfLabeled(Map<String, Integer> counts) {
        return counts.entrySet().stream()
                .map(e -> ScriptFilterOption.builder()
                        .value(e.getKey()).label(e.getKey()).count(e.getValue()).build())
                .toList();
    }

    /**
     * User-id facets (authors / initiators): {@code value == userId}, {@code label ==} the user's
     * display name (full name → email → id). Batch-loads only the ids present in {@code counts}.
     */
    public List<ScriptFilterOption> userLabeled(Map<String, Integer> counts) {
        if (counts.isEmpty()) {
            return List.of();
        }
        Map<String, String> labels = new HashMap<>();
        userRepository.findAllById(counts.keySet()).forEach(u -> labels.put(u.getId(), displayName(u)));
        return counts.entrySet().stream()
                .map(e -> ScriptFilterOption.builder()
                        .value(e.getKey())
                        .label(labels.getOrDefault(e.getKey(), e.getKey()))
                        .count(e.getValue())
                        .build())
                .toList();
    }

    /**
     * Machine-id facet (devices): {@code value ==} the raw machineId (the datafetcher encodes it to a
     * Machine global id on the way out), {@code label ==} hostname → displayName → the raw id.
     * Batch-loads only the ids present in {@code counts}.
     */
    public List<ScriptFilterOption> machineLabeled(Map<String, Integer> counts) {
        if (counts.isEmpty()) {
            return List.of();
        }
        Map<String, String> labels = new HashMap<>();
        machineRepository.findByMachineIdIn(counts.keySet())
                .forEach(m -> labels.put(m.getMachineId(), machineLabel(m)));
        return counts.entrySet().stream()
                .map(e -> ScriptFilterOption.builder()
                        .value(e.getKey())
                        .label(labels.getOrDefault(e.getKey(), e.getKey()))
                        .count(e.getValue())
                        .build())
                .toList();
    }

    private static String displayName(User u) {
        String full = ((u.getFirstName() == null ? "" : u.getFirstName()) + " "
                + (u.getLastName() == null ? "" : u.getLastName())).trim();
        if (!full.isBlank()) {
            return full;
        }
        return hasText(u.getEmail()) ? u.getEmail() : u.getId();
    }

    private static String machineLabel(Machine m) {
        if (hasText(m.getHostname())) {
            return m.getHostname();
        }
        if (hasText(m.getDisplayName())) {
            return m.getDisplayName();
        }
        return m.getMachineId();
    }
}
