package com.openframe.test.data.generator;

import com.openframe.test.data.dto.device.Machine;
import com.openframe.test.data.dto.policy.CreatePolicyRequest;
import com.openframe.test.data.dto.policy.Policy;

import java.util.List;
import java.util.Optional;

import static com.openframe.test.data.generator.DeviceGenerator.getFleetId;

public class MonitoringGenerator {

    public static CreatePolicyRequest windowsVersionPolicy() {
        return CreatePolicyRequest.builder()
                .name("Windows version")
                .description("Validate that version is at least 10")
                .query("SELECT major FROM os_version WHERE major >= 10")
                .build();
    }

    public static Policy.Host policyHost(Machine device) {
        return Policy.Host.builder()
                .id(Integer.valueOf(getFleetId(device)))
                .hostname(device.getHostname())
                .build();
    }

    public static Optional<Policy> findPolicyByName(List<Policy> policies, String name) {
        return policies.stream()
                .filter(p -> name.equals(p.getName()))
                .findFirst();
    }

    public static CreatePolicyRequest emptyPolicy() {
        return CreatePolicyRequest.builder()
                .name("Empty")
                .description("Policy without devices")
                .query("SELECT major FROM os_version WHERE major >= 10")
                .build();
    }
}
