package com.openframe.api.datafetcher.rmm;

import com.openframe.api.dto.rmm.software.SoftwareAutoUpdatePolicyResponse;
import com.openframe.api.dto.rmm.software.SoftwareResponse;
import com.openframe.api.dto.rmm.software.TurnOnSoftwareAutoUpdateInput;
import com.openframe.api.service.rmm.software.SoftwareAutoUpdateService;
import com.openframe.api.service.rmm.software.SoftwareBundleService;
import com.openframe.api.service.rmm.software.SoftwareInventoryService;
import com.openframe.graphql.relay.NodeType;
import com.openframe.graphql.relay.RelayIdCodec;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SoftwareDataFetcherTest {

    private static final String ACTING_USER_ID = "user-1";
    private static final String SOFTWARE_ID = "42";
    private static final String RAW_BUNDLE_ID = "bundle-1";

    @Mock private SoftwareInventoryService softwareInventoryService;
    @Mock private SoftwareAutoUpdateService softwareAutoUpdateService;
    @Mock private SoftwareBundleService softwareBundleService;
    @Spy private RelayIdCodec relayIdCodec = new RelayIdCodec();

    @InjectMocks private SoftwareDataFetcher dataFetcher;

    @BeforeEach
    void signIn() {
        Jwt jwt = Jwt.withTokenValue("token")
                .header("alg", "none")
                .claim("sub", ACTING_USER_ID)
                .build();
        JwtAuthenticationToken authentication = new JwtAuthenticationToken(jwt, AuthorityUtils.NO_AUTHORITIES);
        SecurityContextHolder.getContext().setAuthentication(authentication);
    }

    @AfterEach
    void signOut() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void softwareAutoUpdatePolicy_softwareId_policyOfTheSoftwareReturned() {
        // setup
        SoftwareAutoUpdatePolicyResponse policy = SoftwareAutoUpdatePolicyResponse.builder()
                .enabled(true).machineIds(List.of("m1")).build();
        when(softwareAutoUpdateService.getPolicy(SOFTWARE_ID)).thenReturn(policy);

        // execution
        SoftwareAutoUpdatePolicyResponse result = dataFetcher.softwareAutoUpdatePolicy(SOFTWARE_ID);

        // verifications
        assertThat(result).isSameAs(policy);
    }

    @Test
    void turnOnSoftwareAutoUpdate_bundleGlobalId_rawBundleIdAndActingUserPassedToService() {
        // setup
        TurnOnSoftwareAutoUpdateInput input = new TurnOnSoftwareAutoUpdateInput();
        String bundleGlobalId = relayIdCodec.encode(NodeType.SOFTWARE_BUNDLE, RAW_BUNDLE_ID);
        input.setSoftwareId(SOFTWARE_ID);
        input.setBundleId(bundleGlobalId);
        SoftwareResponse software = SoftwareResponse.builder().id(SOFTWARE_ID).build();
        when(softwareBundleService.turnOnAutoUpdate(input, ACTING_USER_ID)).thenReturn(software);

        // execution
        SoftwareResponse result = dataFetcher.turnOnSoftwareAutoUpdate(input);

        // verifications
        assertThat(result).isSameAs(software);
        assertThat(input.getBundleId()).isEqualTo(RAW_BUNDLE_ID);
    }
}
