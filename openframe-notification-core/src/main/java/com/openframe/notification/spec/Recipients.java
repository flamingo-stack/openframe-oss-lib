package com.openframe.notification.spec;

import lombok.Getter;

import java.util.Set;

@Getter
public final class Recipients {

    private final Set<String> users;
    private final Set<String> machines;

    private Recipients(Set<String> users, Set<String> machines) {
        this.users = users;
        this.machines = machines;
    }

    public static Recipients of(Set<String> users, Set<String> machines) {
        return new Recipients(Set.copyOf(users), Set.copyOf(machines));
    }

    public boolean isEmpty() {
        return users.isEmpty() && machines.isEmpty();
    }
}
