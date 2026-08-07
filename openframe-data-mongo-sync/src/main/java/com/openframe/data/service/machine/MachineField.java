package com.openframe.data.service.machine;

import com.openframe.data.document.device.Machine;

import java.util.function.BiConsumer;

public record MachineField<T>(String path, BiConsumer<Machine, T> setter) {

    public static <T> MachineField<T> field(String path, BiConsumer<Machine, T> setter) {
        return new MachineField<>(path, setter);
    }
}
