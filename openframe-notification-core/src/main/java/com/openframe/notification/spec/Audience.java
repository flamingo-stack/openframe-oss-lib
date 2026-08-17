package com.openframe.notification.spec;

import java.util.Arrays;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.Set;

import static org.apache.commons.lang3.StringUtils.isBlank;

// Null/blank ids are dropped: an absent assignee means "nobody", not a caller error. Empty = pipeline skips.
public final class Audience {

    private static final Audience NONE = new Audience(Set.of(), Set.of());

    private final Set<String> userIds;
    private final Set<String> machineIds;

    private Audience(Set<String> userIds, Set<String> machineIds) {
        this.userIds = userIds;
        this.machineIds = machineIds;
    }

    public static Audience none() {
        return NONE;
    }

    public static Audience users(String... ids) {
        Collection<String> asList = Arrays.asList(ids);
        return users(asList);
    }

    public static Audience users(Collection<String> ids) {
        Set<String> sanitized = sanitize(ids);
        return new Audience(sanitized, Set.of());
    }

    public static Audience machines(String... ids) {
        Collection<String> asList = Arrays.asList(ids);
        return machines(asList);
    }

    public static Audience machines(Collection<String> ids) {
        Set<String> sanitized = sanitize(ids);
        return new Audience(Set.of(), sanitized);
    }

    public Audience andUsers(Collection<String> ids) {
        Set<String> sanitized = sanitize(ids);
        Set<String> merged = union(userIds, sanitized);
        return new Audience(merged, machineIds);
    }

    public Audience andMachines(String... ids) {
        Collection<String> asList = Arrays.asList(ids);
        return andMachines(asList);
    }

    public Audience andMachines(Collection<String> ids) {
        Set<String> sanitized = sanitize(ids);
        Set<String> merged = union(machineIds, sanitized);
        return new Audience(userIds, merged);
    }

    // The standard "don't notify the actor" rule.
    public Audience except(String userId) {
        if (userId == null || !userIds.contains(userId)) {
            return this;
        }
        Set<String> kept = new LinkedHashSet<>(userIds);
        kept.remove(userId);
        Set<String> copied = Set.copyOf(kept);
        return new Audience(copied, machineIds);
    }

    public boolean isEmpty() {
        return userIds.isEmpty() && machineIds.isEmpty();
    }

    public Set<String> users() {
        return userIds;
    }

    public Set<String> machines() {
        return machineIds;
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
