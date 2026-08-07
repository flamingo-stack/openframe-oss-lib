package com.openframe.test.tests;

import com.openframe.test.api.DeviceApi;
import com.openframe.test.api.MonitoringApi;
import com.openframe.test.data.dto.policy.Policy;
import com.openframe.test.helpers.FleetWait;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static com.openframe.test.data.generator.MonitoringGenerator.*;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * Asserts policy compliance by first producing the state it asserts on: refetch every host the policy
 * targets, force the aggregation that recomputes its pass/fail counts, then read the counts.
 *
 * <p><b>Replaces the UI cases in {@code MonitoringTest}</b> ({@code testWindowsVersionPolicyStatus} and
 * {@code testEmptyPolicyStatus}), which asserted the "Compliant" badge on the Monitoring page. Those read
 * a steady state without ever producing it: Fleet only rolls host results into a policy's counts on an
 * hourly cron, so the badge showed "Pending" (or nothing at all) whenever the run landed before an
 * aggregation, and both failed that way repeatedly in the scheduled pipeline. Reading the counts directly
 * also separates "the policy is failing" from "Fleet has not aggregated yet" — a distinction the badge
 * cannot express.
 *
 * <p><b>Why it asserts {@code host_count_updated_at} and not {@code updated_at}.</b> A policy's
 * {@code updated_at} tracks edits to the policy <em>record</em> — neither a host refetch nor the
 * aggregation cron touches it. Fleet stamps {@code host_count_updated_at} when it recomputes
 * {@code passing_host_count} / {@code failing_host_count}, so that is the field that moves here.
 *
 * <p><b>Preconditions.</b> Both policies are seeded by {@code CreatePolicyTest}, and the hosts assigned to
 * them must be ONLINE so they check in and apply the refetch.
 */
@DisplayName("Trigger Policy")
public class TriggerPolicyTest extends BaseTest {

    private static final String WINDOWS_VERSION_POLICY = "Windows version";
    private static final String EMPTY_POLICY = "Empty";

    /**
     * Aggregation is a cron run over the whole Fleet instance, so it is slower than a host check-in.
     */
    private static final int AGGREGATION_TIMEOUT_SECONDS = 180;

    @Tag("mdm")
    @Tag("scheduled")
    @Test
    @DisplayName("Windows version policy is compliant after a forced re-evaluation")
    public void testWindowsVersionPolicyIsCompliant() {
        Policy policy = resolveSeededPolicy(WINDOWS_VERSION_POLICY, windowsVersionPolicy().getQuery());

        List<Policy.Host> hosts = assignedHosts(policy);
        assertThat(hosts)
                .as("Policy '%s' (id %s) has no assigned hosts to refetch — CreatePolicyTest assigns one",
                        WINDOWS_VERSION_POLICY, policy.getId())
                .isNotEmpty();

        Policy aggregated = reEvaluate(policy, hosts);

        assertThat(aggregated.getFailingHostCount())
                .as("Policy '%s' is not compliant: %s of %d assigned host(s) failing",
                        WINDOWS_VERSION_POLICY, aggregated.getFailingHostCount(), hosts.size())
                .isZero();
        assertThat(aggregated.getPassingHostCount())
                .as("Policy '%s' reports %s passing host(s), expected all %d assigned host(s) to pass",
                        WINDOWS_VERSION_POLICY, aggregated.getPassingHostCount(), hosts.size())
                .isEqualTo(hosts.size());
    }

    @Tag("mdm")
    @Tag("scheduled")
    @Test
    @DisplayName("Empty policy is compliant with no assigned hosts")
    public void testEmptyPolicyIsCompliant() {
        Policy policy = resolveSeededPolicy(EMPTY_POLICY, emptyPolicy().getQuery());

        // "Empty" is the deliberately untargeted policy ("Policy without devices"). Fleet leaves
        // hosts_include_any null in that case and no host evaluates it — verified against qa: the policy
        // is absent from every host's policies list, yet aggregation still stamps its counts.
        List<Policy.Host> hosts = assignedHosts(policy);
        assertThat(hosts)
                .as("Policy '%s' (id %s) has hosts assigned, so it is no longer the no-device policy "
                        + "this case covers", EMPTY_POLICY, policy.getId())
                .isEmpty();

        Policy aggregated = reEvaluate(policy, hosts);

        assertThat(aggregated.getFailingHostCount())
                .as("Policy '%s' is not compliant: %s host(s) failing despite no hosts assigned",
                        EMPTY_POLICY, aggregated.getFailingHostCount())
                .isZero();
        assertThat(aggregated.getPassingHostCount())
                .as("Policy '%s' reports %s passing host(s) despite no hosts assigned",
                        EMPTY_POLICY, aggregated.getPassingHostCount())
                .isZero();
    }

    /**
     * Resolves a seeded policy by name and guards its definition. Editing a policy's query silently resets
     * its pass/fail results, so a drifted query would otherwise surface downstream as a bare "not
     * compliant" failure with no hint of the cause.
     */
    private static Policy resolveSeededPolicy(String name, String expectedQuery) {
        // The list endpoint resolves the name, but hosts_include_any only comes back on the detail read.
        Policy listed = findPolicyByName(MonitoringApi.getPolicies(), name).orElse(null);
        assertThat(listed)
                .as("No policy named '%s' — CreatePolicyTest seeds it", name)
                .isNotNull();
        Policy policy = MonitoringApi.getPolicy(listed.getId());
        assertThat(policy.getQuery())
                .as("Policy '%s' (id %s) has been edited away from the seeded definition — "
                        + "compliance below is meaningless until it is restored", name, policy.getId())
                .isEqualTo(expectedQuery);
        return policy;
    }

    /**
     * Fleet returns a null {@code hosts_include_any} for an untargeted policy rather than an empty list.
     */
    private static List<Policy.Host> assignedHosts(Policy policy) {
        return policy.getHostsIncludeAny() == null ? List.of() : policy.getHostsIncludeAny();
    }

    /**
     * Re-evaluates the policy on every host it targets and forces the aggregation, so the counts the
     * caller asserts on are known to be freshly computed rather than up to an hour stale.
     *
     * @return the policy re-read after its counts were re-aggregated
     */
    private static Policy reEvaluate(Policy policy, List<Policy.Host> hosts) {
        // A policy whose results have been reset (or that has never aggregated) reports a null
        // host_count_updated_at with 0/0 counts. That is a valid starting point — treat it as "never",
        // so the assertion below still means "aggregation stamped it during this run".
        Instant lastAggregated = aggregatedAt(policy);
        Instant aggregatedBefore = lastAggregated == null ? Instant.EPOCH : lastAggregated;

        // Wait for each host to actually report, otherwise the aggregation below could run before any
        // fresh result exists and the counts would just be the previous run's.
        for (Policy.Host host : hosts) {
            String fleetId = String.valueOf(host.getId());
            Instant hostBefore = Instant.parse(DeviceApi.getFleetInfo(fleetId).getPolicyUpdatedAt());

            MonitoringApi.refetchFleetHost(fleetId);

            var refetched = FleetWait.until(
                    "host " + host.getHostname() + " to re-evaluate its policies",
                    () -> DeviceApi.getFleetInfo(fleetId),
                    h -> Instant.parse(h.getPolicyUpdatedAt()).isAfter(hostBefore));
            assertThat(Instant.parse(refetched.getPolicyUpdatedAt()))
                    .as("Host %s (fleetId %s) did not re-evaluate its policies after the refetch "
                            + "(refetch_requested=%s)", host.getHostname(), fleetId, refetched.isRefetchRequested())
                    .isAfter(hostBefore);
        }

        // Fleet only rolls host results into the policy's counts on an hourly cron, so force that run
        // rather than waiting it out.
        MonitoringApi.triggerCronSchedule(MonitoringApi.CLEANUPS_THEN_AGGREGATION);

        Policy aggregated = FleetWait.until(
                "policy '" + policy.getName() + "' counts to be re-aggregated",
                () -> MonitoringApi.getPolicy(policy.getId()),
                p -> {
                    Instant at = aggregatedAt(p);
                    return at != null && at.isAfter(aggregatedBefore);
                },
                AGGREGATION_TIMEOUT_SECONDS);

        assertThat(aggregatedAt(aggregated))
                .as("Policy '%s' still reports no host_count_updated_at after triggering %s",
                        policy.getName(), MonitoringApi.CLEANUPS_THEN_AGGREGATION)
                .isNotNull();
        assertThat(aggregatedAt(aggregated))
                .as("Policy '%s' counts were not re-aggregated within %ds of triggering %s "
                                + "(passing=%s, failing=%s)", policy.getName(), AGGREGATION_TIMEOUT_SECONDS,
                        MonitoringApi.CLEANUPS_THEN_AGGREGATION,
                        aggregated.getPassingHostCount(), aggregated.getFailingHostCount())
                .isAfter(aggregatedBefore);
        return aggregated;
    }

    /**
     * {@code host_count_updated_at} as an {@link Instant}, or {@code null} when the policy has never
     * been aggregated — Fleet leaves the field null on a policy whose results were reset.
     */
    private static Instant aggregatedAt(Policy policy) {
        String value = policy.getHostCountUpdatedAt();
        return value == null || value.isBlank() ? null : Instant.parse(value);
    }
}
