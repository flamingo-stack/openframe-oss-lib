package com.openframe.api.datafetcher;

import com.openframe.api.relay.InvalidRelayIdException;
import com.openframe.api.relay.NodeType;
import com.openframe.api.relay.RelayIdCodec;
import com.openframe.api.service.device.DeviceService;
import com.openframe.data.document.device.Machine;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NodeDataFetcherRelayIdTest {

    private static final String MACHINE_ID = "machine-1";
    private static final String RAW_OBJECT_ID = "507f1f77bcf86cd799439011";

    @Mock private DeviceService deviceService;
    @Spy private RelayIdCodec relayIdCodec = new RelayIdCodec();

    @InjectMocks private NodeDataFetcher dataFetcher;

    private final RelayIdCodec codec = new RelayIdCodec();
    private final Machine machine = new Machine();

    @ParameterizedTest
    @ValueSource(strings = {RAW_OBJECT_ID, MACHINE_ID})
    void node_rawId_throwsInvalidRelayId(String rawId) {
        // execution
        InvalidRelayIdException exception = assertThrows(InvalidRelayIdException.class,
                () -> dataFetcher.node(rawId));

        // verifications
        assertThat(exception.getMessage()).isEqualTo("Invalid node id");
        verifyNoInteractions(deviceService);
    }

    @Test
    void node_machineGlobalId_resolvedByRawId() {
        // setup
        String machineGlobalId = codec.encode(NodeType.MACHINE, MACHINE_ID);
        when(deviceService.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));

        // execution
        Object node = dataFetcher.node(machineGlobalId);

        // verifications
        assertThat(node).isSameAs(machine);
    }

    @Test
    void nodes_rawAndGlobalIds_nullForTheRawId() {
        // setup
        String machineGlobalId = codec.encode(NodeType.MACHINE, MACHINE_ID);
        List<String> ids = List.of(RAW_OBJECT_ID, machineGlobalId);
        when(deviceService.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));

        // execution
        List<Object> nodes = dataFetcher.nodes(ids);

        // verifications
        assertThat(nodes).containsExactly(null, machine);
    }
}
