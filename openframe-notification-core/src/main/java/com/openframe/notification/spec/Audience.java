package com.openframe.notification.spec;

import com.openframe.data.document.user.UserRole;

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
    // Effective roles (an owner is an admin too): the resolver widens them with UserRole.grantedFor.
    final Set<UserRole> activeRoles;
    final Set<String> excludedUserIds;

    private Audience(Set<String> userIds, Set<String> machineIds,
                     Set<UserRole> activeRoles, Set<String> excludedUserIds) {
        this.userIds = userIds;
        this.machineIds = machineIds;
        this.activeRoles = activeRoles;
        this.excludedUserIds = excludedUserIds;
    }

    public static Audience none() {
        return new Audience(Set.of(), Set.of(), Set.of(), Set.of());
    }

    public static Audience users(String... ids) {
        Collection<String> asList = Arrays.asList(ids);
        return users(asList);
    }

    public static Audience users(Collection<String> ids) {
        Set<String> sanitized = sanitize(ids);
        return new Audience(sanitized, Set.of(), Set.of(), Set.of());
    }

    public static Audience machines(String... ids) {
        Collection<String> asList = Arrays.asList(ids);
        return machines(asList);
    }

    public static Audience machines(Collection<String> ids) {
        Set<String> sanitized = sanitize(ids);
        return new Audience(Set.of(), sanitized, Set.of(), Set.of());
    }

    /** Every active user who is effectively this role: ADMIN reaches the owners too, OWNER only them. */
    public static Audience allActive(UserRole role) {
        Set<UserRole> roles = Set.of(role);
        return new Audience(Set.of(), Set.of(), roles, Set.of());
    }

    public static Audience allActiveAdmins() {
        return allActive(UserRole.ADMIN);
    }

    public Audience andUsers(Collection<String> ids) {
        Set<String> sanitized = sanitize(ids);
        Set<String> merged = union(userIds, sanitized);
        return new Audience(merged, machineIds, activeRoles, excludedUserIds);
    }

    public Audience andMachines(String... ids) {
        Collection<String> asList = Arrays.asList(ids);
        return andMachines(asList);
    }

    public Audience andMachines(Collection<String> ids) {
        Set<String> sanitized = sanitize(ids);
        Set<String> merged = union(machineIds, sanitized);
        return new Audience(userIds, merged, activeRoles, excludedUserIds);
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
        return new Audience(keptCopy, machineIds, activeRoles, excluded);
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
