package com.openframe.test.tests;

import com.openframe.test.api.MonitoringApi;
import com.openframe.test.data.dto.policy.Policy;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static com.openframe.test.data.generator.MonitoringGenerator.findPolicyByName;
import static org.assertj.core.api.Assertions.assertThat;

@Tag("archive")
public class DeletePolicyTest extends BaseTest {

    @Test
    public void testDeleteEmptyPolicy() {
        List<Policy> policies = MonitoringApi.getPolicies();
        assertThat(policies).as("No policie").isNotEmpty();
        Optional<Policy> policy = findPolicyByName(policies, "Empty");
        assertThat(policy).as("Policy 'Empty' should exist").isPresent();

        List<Integer> deleted = MonitoringApi.deletePolicy(policy.get().getId());
        assertThat(deleted).contains(policy.get().getId());
    }

    @Test
    public void testDeletePolicyWithDevices() {
        List<Policy> policies = MonitoringApi.getPolicies();
        assertThat(policies).as("No policie").isNotEmpty();
        Optional<Policy> policy = findPolicyByName(policies, "Windows version");
        assertThat(policy).as("Policy 'Windows version' should exist").isPresent();

        List<Integer> deleted = MonitoringApi.deletePolicy(policy.get().getId());
        assertThat(deleted).contains(policy.get().getId());
    }
}
