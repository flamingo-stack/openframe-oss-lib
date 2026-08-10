package com.openframe.data.service.machine;

import com.openframe.data.document.device.Machine;
import org.springframework.data.mongodb.core.query.Update;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.function.Consumer;

public final class MachineUpdate {

    private final Update update = new Update();
    private final List<Consumer<Machine>> mutations = new ArrayList<>();
    private final Set<String> paths = new LinkedHashSet<>();

    private MachineUpdate() {
    }

    public static MachineUpdate machineUpdate() {
        return new MachineUpdate();
    }

    public <T> MachineUpdate set(MachineField<T> field, T value) {
        update.set(field.path(), value);
        mutations.add(machine -> field.setter().accept(machine, value));
        paths.add(field.path());
        return this;
    }

    public boolean isEmpty() {
        return mutations.isEmpty();
    }

    public Set<String> paths() {
        return Collections.unmodifiableSet(paths);
    }

    public void applyTo(Machine machine) {
        mutations.forEach(mutation -> mutation.accept(machine));
    }

    Update toMongoUpdate() {
        return update;
    }
}
