package com.openframe.notification.spec;

import java.util.Arrays;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.Set;

import static org.apache.commons.lang3.StringUtils.isBlank;

// A declaration of intended recipients, not a recipient list: ids are deliberately unreachable
// from outside the package — the only way to get them is AudienceResolver.resolve(), so an
// unresolved declaration cannot leak into a dispatch.
public final class Audience {

    final Set<String> userIds;
    final Set<String> machineIds;
    final boolean allActiveAdmins;
    final Set<String> excludedUserIds;

    private Audience(Set<String> userIds, Set<String> machineIds,
                     boolean allActiveAdmins, Set<String> excludedUserIds) {
        this.userIds = userIds;
        this.machineIds = machineIds;
        this.allActiveAdmins = allActiveAdmins;
        this.excludedUserIds = excludedUserIds;
    }

    public static Audience none() {
        return new Audience(Set.of(), Set.of(), false, Set.of());
    }

    public static Audience users(String... ids) {
        Collection<String> asList = Arrays.asList(ids);
        return users(asList);
    }

    public static Audience users(Collection<String> ids) {
        Set<String> sanitized = sanitize(ids);
        return new Audience(sanitized, Set.of(), false, Set.of());
    }

    public static Audience machines(String... ids) {
        Collection<String> asList = Arrays.asList(ids);
        return machines(asList);
    }

    public static Audience machines(Collection<String> ids) {
        Set<String> sanitized = sanitize(ids);
        return new Audience(Set.of(), sanitized, false, Set.of());
    }

    public static Audience allActiveAdmins() {
        return new Audience(Set.of(), Set.of(), true, Set.of());
    }

    public Audience andUsers(Collection<String> ids) {
        Set<String> sanitized = sanitize(ids);
        Set<String> merged = union(userIds, sanitized);
        return new Audience(merged, machineIds, allActiveAdmins, excludedUserIds);
    }

    public Audience andMachines(String... ids) {
        Collection<String> asList = Arrays.asList(ids);
        return andMachines(asList);
    }

    public Audience andMachines(Collection<String> ids) {
        Set<String> sanitized = sanitize(ids);
        Set<String> merged = union(machineIds, sanitized);
        return new Audience(userIds, merged, allActiveAdmins, excludedUserIds);
    }

    // Two-phase: cuts the id from the explicit set now AND from whatever a marker resolves to later.
    public Audience except(String userId) {
        if (isBlank(userId)) {
            return this;
        }
        Set<String> kept = new LinkedHashSet<>(userIds);
        kept.remove(userId);
        Set<String> keptCopy = Set.copyOf(kept);
        Set<String> excluded = union(excludedUserIds, Set.of(userId));
        return new Audience(keptCopy, machineIds, allActiveAdmins, excluded);
    }

    private static Set<String> sanitize(Collection<String> ids) {
        if (ids == null) {
            return Set.of();
        }
        Set<String> kept = new LinkedHashSet<>();
        for (String id : ids) {
            if (!isBlank(id)) {
                kept.add(id);
            }
        }
        return Set.copyOf(kept);
    }

    private static Set<String> union(Set<String> left, Set<String> right) {
        Set<String> merged = new LinkedHashSet<>(left);
        merged.addAll(right);
        return Set.copyOf(merged);
    }
}
