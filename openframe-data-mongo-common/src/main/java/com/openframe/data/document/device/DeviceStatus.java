package com.openframe.data.document.device;

import java.util.Collection;
import java.util.EnumSet;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Stream;

import static java.util.stream.Collectors.toCollection;

public enum DeviceStatus {
    PENDING,
    MANAGED,
    PENDING_DELETION,
    DELETED,
    ARCHIVED;

    public static final Set<DeviceStatus> CONNECTED = EnumSet.of(MANAGED);
    // Heartbeats keep connectivity and lastSeen moving but never change these; an ARCHIVED device also stops taking
    // hostname, timezone and package-manager reports and only a reinstall brings it back, as PENDING.
    public static final Set<DeviceStatus> FROZEN = EnumSet.of(PENDING_DELETION, DELETED, ARCHIVED);

    private static final Map<String, DeviceStatus> RETIRED_NAMES = Map.of(
            "ONLINE", MANAGED,
            "OFFLINE", MANAGED,
            "ACTIVE", MANAGED,
            "INACTIVE", ARCHIVED,
            "MAINTENANCE", ARCHIVED,
            "DECOMMISSIONED", ARCHIVED);

    public static DeviceStatus fromStored(String name) {
        return Optional.ofNullable(RETIRED_NAMES.get(name))
                .orElseGet(() -> valueOf(name));
    }

    public static Set<String> storedNames(DeviceStatus status) {
        Stream<String> retired = RETIRED_NAMES.entrySet().stream()
                .filter(entry -> entry.getValue() == status)
                .map(Map.Entry::getKey)
                .sorted();
        return Stream.concat(Stream.of(status.name()), retired)
                .collect(toCollection(LinkedHashSet::new));
    }

    public static Set<String> storedNames(Collection<DeviceStatus> statuses) {
        return statuses.stream()
                .flatMap(status -> storedNames(status).stream())
                .collect(toCollection(LinkedHashSet::new));
    }

    public boolean isConnected() {
        return CONNECTED.contains(this);
    }
}
