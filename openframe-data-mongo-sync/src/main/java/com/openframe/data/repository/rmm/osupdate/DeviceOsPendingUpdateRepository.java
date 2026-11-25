package com.openframe.data.repository.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.DeviceOsPendingUpdate;
import com.openframe.data.document.rmm.osupdate.OsPlatform;
import org.springframework.data.mongodb.repository.Aggregation;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

@Repository
public interface DeviceOsPendingUpdateRepository
        extends MongoRepository<DeviceOsPendingUpdate, String>, CustomDeviceOsPendingUpdateRepository {

    List<DeviceOsPendingUpdate> findByTenantIdAndMachineIdOrderByDiscoveredAtDescIdentifierAsc(
            String tenantId, String machineId);

    long deleteByTenantIdAndMachineId(String tenantId, String machineId);

    // A device has one pending row per update, so the rows of an identifier are its devices.
    @Aggregation(pipeline = {
            "{ '$match': { 'tenantId': ?0, 'platform': ?1, 'identifier': { '$in': ?2 }, 'machineId': { '$nin': ?3 } } }",
            "{ '$group': { '_id': '$identifier', 'deviceCount': { '$sum': 1 } } }"})
    List<OsUpdateDeviceCount> countDevicesByIdentifier(String tenantId, OsPlatform platform,
                                                       Collection<String> identifiers,
                                                       Collection<String> excludedMachineIds);

    @Aggregation(pipeline = {
            "{ '$match': { 'tenantId': ?0, 'platform': ?1, 'identifier': { '$in': ?2 }, 'machineId': { '$in': ?3 } } }",
            "{ '$group': { '_id': '$identifier', 'deviceCount': { '$sum': 1 } } }"})
    List<OsUpdateDeviceCount> countDevicesByIdentifierOnMachines(String tenantId, OsPlatform platform,
                                                                 Collection<String> identifiers,
                                                                 Collection<String> machineIds);

    @Aggregation(pipeline = {
            "{ '$match': { 'tenantId': ?0, 'machineId': { '$in': ?1 } } }",
            "{ '$group': { '_id': '$platform', 'identifiers': { '$addToSet': '$identifier' } } }"})
    List<OsUpdateIdentifiersOfPlatform> findIdentifiersByPlatformOnMachines(String tenantId,
                                                                            Collection<String> machineIds);
}
