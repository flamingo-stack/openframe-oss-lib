package com.openframe.notification.spec;

import java.util.Arrays;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

import static org.apache.commons.lang3.StringUtils.isBlank;

/**
 * Recipients of one notification. Null and blank ids are dropped on construction: an absent
 * assignee means "nobody", not a caller error. An empty audience is a legal outcome — the
 * pipeline skips the notification.
 */
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
        return users(Arrays.asList(ids));
    }

    public static Audience users(Collection<String> ids) {
        return new Audience(sanitize(ids), Set.of());
    }

    public static Audience machines(String... ids) {
        return machines(Arrays.asList(ids));
    }

    public static Audience machines(Collection<String> ids) {
        return new Audience(Set.of(), sanitize(ids));
    }

    public Audience andUsers(Collection<String> ids) {
        return new Audience(union(userIds, sanitize(ids)), machineIds);
    }

    public Audience andMachines(String... ids) {
        return andMachines(Arrays.asList(ids));
    }

    public Audience andMachines(Collection<String> ids) {
        return new Audience(userIds, union(machineIds, sanitize(ids)));
    }

    /** Cuts the initiator out of the user audience; the standard "don't notify the actor" rule. */
    public Audience except(String userId) {
        if (userId == null || !userIds.contains(userId)) {
            return this;
        }
        Set<String> kept = new LinkedHashSet<>(userIds);
        kept.remove(userId);
        return new Audience(Set.copyOf(kept), machineIds);
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
