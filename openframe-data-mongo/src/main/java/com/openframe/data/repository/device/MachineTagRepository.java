package com.openframe.data.repository.device;

import com.openframe.data.document.device.MachineTag;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MachineTagRepository extends MongoRepository<MachineTag, String> {
    List<MachineTag> findByMachineId(String machineId);

    List<MachineTag> findByTagId(String tagId);

    void deleteByMachineIdAndTagId(String machineId, String tagId);

    List<MachineTag> findByMachineIdIn(List<String> machineIds);

    List<MachineTag> findByTagIdIn(List<String> tagIds);

    // Lookup for upsert pattern
    Optional<MachineTag> findByMachineIdAndTagId(String machineId, String tagId);

    // For bulk operations
    List<MachineTag> findByMachineIdInAndTagIdIn(List<String> machineIds, List<String> tagIds);

    void deleteByTagId(String tagId);

    /**
     * Find machine tags where the values array contains any of the given values.
     * Uses MongoDB $in operator on the array field, which matches documents
     * where the array contains at least one element in the given list.
     */
    @Query("{ 'values': { $in: ?0 } }")
    List<MachineTag> findByValuesContainingAny(List<String> values);

    /**
     * Find machine tags for specific tag IDs where values contain any of the given values.
     */
    @Query("{ 'tagId': { $in: ?0 }, 'values': { $in: ?1 } }")
    List<MachineTag> findByTagIdInAndValuesContainingAny(List<String> tagIds, List<String> values);
}
