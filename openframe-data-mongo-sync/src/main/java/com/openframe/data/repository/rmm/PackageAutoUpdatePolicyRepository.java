package com.openframe.data.repository.rmm;

import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.software.PackageAutoUpdatePolicy;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.data.mongodb.repository.Update;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface PackageAutoUpdatePolicyRepository extends MongoRepository<PackageAutoUpdatePolicy, String>, CustomPackageAutoUpdatePolicyRepository {

    List<PackageAutoUpdatePolicy> findByTenantIdAndEnabledTrue(String tenantId);

    List<PackageAutoUpdatePolicy> findByTenantIdAndSoftwareIdIn(String tenantId, Collection<String> softwareIds);

    List<PackageAutoUpdatePolicy> findByTenantIdAndMachineIdAndSoftwareIdIn(String tenantId, String machineId,
                                                                            Collection<String> softwareIds);

    List<PackageAutoUpdatePolicy> findByTenantIdAndSoftwareIdAndMachineIdIn(String tenantId, String softwareId,
                                                                            Collection<String> machineIds);

    @Query("{ '_id': { '$in': ?0 } }")
    @Update("{ '$set': { 'lastVersion': ?1 }, '$unset': { 'retryRequestId': '' } }")
    long markOrdered(Collection<String> policyIds, String version);

    Optional<PackageAutoUpdatePolicy> findByTenantIdAndMachineIdAndPackageManagerAndPackageName(
            String tenantId, String machineId, PackageManagerType packageManager, String packageName);

    // Both write only while the policy is still on and still at the version the caller read: a newer order
    // (markOrdered) or a re-enable in between makes them match nothing, and the caller backs off.
    @Query("{ '_id': ?0, 'enabled': true, 'lastVersion': ?1 }")
    @Update("{ '$set': { 'retryRequestId': ?2 } }")
    long markRetryScheduled(String policyId, String lastVersion, String requestId);

    @Query("{ '_id': ?0, 'enabled': true, 'lastVersion': ?1 }")
    @Update("{ '$set': { 'enabled': false, 'updatedBy': ?2, 'updatedAt': ?3 } }")
    long disable(String policyId, String lastVersion, String actor, Instant at);
}
