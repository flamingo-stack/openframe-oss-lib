package com.openframe.api.dataloader;

import com.openframe.api.dto.device.MachineTag;
import com.openframe.api.service.TagService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MachineTagDataLoaderTest {

    @Mock private TagService tagService;

    @InjectMocks private MachineTagDataLoader loader;

    @Test
    void load_machineIds_oneAssignmentListPerMachineFromTheService() {
        // setup
        List<String> machineIds = List.of("m-1", "m-2");
        List<List<MachineTag>> perMachine = List.of(List.of(MachineTag.builder().id("as-1").build()), List.of());
        when(tagService.getTagAssignmentsForMachines(machineIds)).thenReturn(perMachine);

        // execution
        List<List<MachineTag>> result = loader.load(machineIds).toCompletableFuture().join();

        // verifications
        assertThat(result).isSameAs(perMachine);
    }
}
