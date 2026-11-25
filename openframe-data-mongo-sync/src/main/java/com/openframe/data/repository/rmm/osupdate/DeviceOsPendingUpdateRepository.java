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
            "{ '$match': { 'tenantId': ?3, 'platform': ?0, 'identifier': { '$in': ?1 }, 'machineId': { '$nin': ?2 } } }",
            "{ '$group': { '_id': '$identifier', 'deviceCount': { '$sum': 1 } } }"})
    List<OsUpdateDeviceCount> countDevicesByIdentifier(OsPlatform platform, Collection<String> identifiers,
                                                       Collection<String> excludedMachineIds, String tenantId);

    @Aggregation(pipeline = {
            "{ '$match': { 'tenantId': ?3, 'platform': ?0, 'identifier': { '$in': ?1 }, 'machineId': { '$in': ?2 } } }",
            "{ '$group': { '_id': '$identifier', 'deviceCount': { '$sum': 1 } } }"})
    List<OsUpdateDeviceCount> countDevicesByIdentifierOnMachines(OsPlatform platform,
                                                                 Collection<String> identifiers,
                                                                 Collection<String> machineIds, String tenantId);

    @Aggregation(pipeline = {
            "{ '$match': { 'tenantId': ?1, 'machineId': { '$in': ?0 } } }",
            "{ '$group': { '_id': '$platform', 'identifiers': { '$addToSet': '$identifier' } } }"})
    List<OsUpdateIdentifiersOfPlatform> findIdentifiersByPlatformOnMachines(Collection<String> machineIds,
                                                                            String tenantId);
}
