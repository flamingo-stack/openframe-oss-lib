package com.openframe.data.service.machine;

import com.openframe.data.document.device.Machine;

public record MachineWriteResult(Machine before, Machine after) {
}
