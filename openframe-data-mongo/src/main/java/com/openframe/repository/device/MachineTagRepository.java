package com.openframe.repository.device;

import com.openframe.document.device.MachineTag;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MachineTagRepository extends MongoRepository<MachineTag, String> {
    List<MachineTag> findByMachineId(String machineId);

    List<MachineTag> findByTagId(String tagId);

    void deleteByMachineId(String machineId);

    void deleteByMachineIdAndTagId(String machineId, String tagId);

    List<MachineTag> findByMachineIdIn(List<String> machineIds);

    List<MachineTag> findByTagIdIn(List<String> tagIds);
}
