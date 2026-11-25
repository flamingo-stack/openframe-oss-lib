package com.openframe.data.repository.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.DeviceOsUpdateHistoryEntry;
import org.springframework.data.mongodb.repository.Aggregation;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

@Repository
// WARNING: the aggregations write the operation and result enum names out; a renamed constant matches nothing
public interface DeviceOsUpdateHistoryRepository
        extends MongoRepository<DeviceOsUpdateHistoryEntry, String>, CustomDeviceOsUpdateHistoryRepository {

    List<DeviceOsUpdateHistoryEntry> findByTenantIdAndMachineIdAndEntryKeyIn(
            String tenantId, String machineId, Collection<String> entryKeys);

    long deleteByTenantIdAndMachineId(String tenantId, String machineId);

    @Aggregation(pipeline = {
            "{ '$match': { 'tenantId': ?0, 'identifier': { '$in': ?1 }, 'operation': 'INSTALL', 'result': { '$in': ['SUCCEEDED', 'SUCCEEDED_WITH_ERRORS'] } } }",
            "{ '$group': { '_id': { 'identifier': '$identifier', 'machineId': '$machineId' } } }",
            "{ '$group': { '_id': '$_id.identifier', 'deviceCount': { '$sum': 1 } } }"})
    List<OsUpdateDeviceCount> countInstalledDevicesByIdentifier(String tenantId, Collection<String> identifiers);

    @Aggregation(pipeline = {
            "{ '$match': { 'tenantId': ?0, 'identifier': { '$in': ?1 }, 'machineId': { '$in': ?2 }, 'operation': 'INSTALL', 'result': { '$in': ['SUCCEEDED', 'SUCCEEDED_WITH_ERRORS'] } } }",
            "{ '$group': { '_id': { 'identifier': '$identifier', 'machineId': '$machineId' } } }",
            "{ '$group': { '_id': '$_id.identifier', 'deviceCount': { '$sum': 1 } } }"})
    List<OsUpdateDeviceCount> countInstalledDevicesByIdentifierOnMachines(String tenantId,
                                                                          Collection<String> identifiers,
                                                                          Collection<String> machineIds);

    @Aggregation(pipeline = {
            "{ '$match': { 'tenantId': ?0, 'machineId': { '$in': ?1 }, 'operation': 'INSTALL', 'result': { '$in': ['SUCCEEDED', 'SUCCEEDED_WITH_ERRORS'] } } }",
            "{ '$group': { '_id': '$identifier' } }"})
    List<String> findInstalledIdentifiersOnMachines(String tenantId, Collection<String> machineIds);
}
