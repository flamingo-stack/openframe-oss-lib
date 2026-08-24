package com.openframe.data.service.machine;

import com.openframe.data.document.device.Machine;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.util.function.BiConsumer;

@Getter
@AllArgsConstructor
public class MachineField<T> {

    private final String path;
    private final BiConsumer<Machine, T> setter;

    public static <T> MachineField<T> field(String path, BiConsumer<Machine, T> setter) {
        return new MachineField<>(path, setter);
    }
}
