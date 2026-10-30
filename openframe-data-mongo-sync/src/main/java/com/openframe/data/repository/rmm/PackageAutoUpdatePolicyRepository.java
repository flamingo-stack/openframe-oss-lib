package com.openframe.data.repository.rmm;

import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.software.PackageAutoUpdatePolicy;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.data.mongodb.repository.Update;
import org.springframework.stereotype.Repository;

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

    @Query("{ '_id': ?0 }")
    @Update("{ '$set': { 'retryRequestId': ?1 } }")
    long markRetryScheduled(String policyId, String requestId);
}
