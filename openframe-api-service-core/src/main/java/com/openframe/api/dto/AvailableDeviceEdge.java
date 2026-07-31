package com.openframe.api.dto;

import com.openframe.data.document.device.Machine;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class AvailableDeviceEdge extends GenericEdge<Machine> {

    private boolean assigned;

    public AvailableDeviceEdge(Machine node, String cursor, boolean assigned) {
        super(node, cursor);
        this.assigned = assigned;
    }
}
