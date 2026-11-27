package com.openframe.api.datafetcher.rmm;

import com.openframe.api.dataloader.OsUpdateCustomerStatusesDataLoader;
import com.openframe.api.dataloader.OsUpdateDeviceCountsDataLoader;
import com.openframe.api.mapper.DeviceOsGraphQLMapper;
import com.openframe.api.mapper.DeviceOsResponseMapper;
import com.openframe.api.mapper.OsUpdateGraphQLMapper;
import com.openframe.api.mapper.OsUpdateResponseMapper;
import com.openframe.api.service.device.DeviceService;
import com.openframe.api.service.shared.CursorPageAssembler;
import com.openframe.api.service.rmm.osupdate.DeviceOsPendingUpdateService;
import com.openframe.api.service.rmm.osupdate.DeviceOsStateService;
import com.openframe.api.service.rmm.osupdate.DeviceOsUpdateHistoryService;
import com.openframe.api.service.rmm.osupdate.OsUpdateDeviceService;
import com.openframe.api.service.rmm.osupdate.OsUpdateService;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.rmm.osupdate.DeviceOsPendingUpdateRepository;
import com.openframe.data.repository.rmm.osupdate.DeviceOsStateRepository;
import com.openframe.data.repository.rmm.osupdate.DeviceOsUpdateHistoryRepository;
import com.openframe.data.repository.rmm.osupdate.OsUpdateRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.api.mapper.OsUpdatePolicyGraphQLMapper;
import com.openframe.api.mapper.OsUpdatePolicyResponseMapper;
import com.openframe.api.service.rmm.osupdate.OsUpdateOverrideService;
import com.openframe.api.service.rmm.osupdate.OsUpdatePolicyService;
import com.openframe.api.service.rmm.osupdate.OsUpdatePolicyValidator;
import com.openframe.data.repository.rmm.osupdate.DeviceOsUpdateRolloutStateRepository;
import com.openframe.data.repository.rmm.osupdate.OsUpdateOverrideRepository;
import com.openframe.data.repository.rmm.osupdate.OsUpdatePolicyRepository;
import com.openframe.data.repository.tag.TagAssignmentRepository;
import com.openframe.data.service.rmm.osupdate.DeviceOsUpdateRolloutStateService;
import com.openframe.data.service.rmm.osupdate.OsUpdateCustomerStatusResolver;
import com.openframe.data.service.rmm.osupdate.OsUpdatePolicyResolver;
import com.openframe.graphql.relay.RelayIdCodec;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class DeviceOsWiringTest {

    private static final String FLAG = "openframe.rmm.os-update.enabled";

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withBean(MachineRepository.class, () -> mock(MachineRepository.class))
            .withBean(DeviceOsStateRepository.class, () -> mock(DeviceOsStateRepository.class))
            .withBean(DeviceOsPendingUpdateRepository.class, () -> mock(DeviceOsPendingUpdateRepository.class))
            .withBean(OsUpdateRepository.class, () -> mock(OsUpdateRepository.class))
            .withBean(DeviceOsUpdateHistoryRepository.class, () -> mock(DeviceOsUpdateHistoryRepository.class))
            .withBean(DeviceService.class, () -> mock(DeviceService.class))
            .withBean(TenantIdProvider.class, () -> mock(TenantIdProvider.class))
            .withBean(DeviceOsUpdateRolloutStateRepository.class,
                    () -> mock(DeviceOsUpdateRolloutStateRepository.class))
            .withBean(OsUpdatePolicyRepository.class, () -> mock(OsUpdatePolicyRepository.class))
            .withBean(OsUpdateOverrideRepository.class, () -> mock(OsUpdateOverrideRepository.class))
            .withBean(TagAssignmentRepository.class, () -> mock(TagAssignmentRepository.class))
            .withBean(DeviceOsUpdateRolloutStateService.class, () -> mock(DeviceOsUpdateRolloutStateService.class))
            .withBean(OsUpdatePolicyResolver.class, OsUpdatePolicyResolver::new)
            .withBean(OsUpdateCustomerStatusResolver.class, () -> mock(OsUpdateCustomerStatusResolver.class))
            .withBean(RelayIdCodec.class, () -> mock(RelayIdCodec.class))
            .withUserConfiguration(DeviceOsDataFetcher.class, DeviceOsStateService.class,
                    DeviceOsPendingUpdateService.class, DeviceOsUpdateHistoryService.class, CursorPageAssembler.class,
                    DeviceOsResponseMapper.class, DeviceOsGraphQLMapper.class,
                    OsUpdateDataFetcher.class, OsUpdateService.class, OsUpdateDeviceService.class, OsUpdateResponseMapper.class,
                    OsUpdateGraphQLMapper.class, OsUpdateDeviceCountsDataLoader.class,
                    OsUpdateCustomerStatusesDataLoader.class,
                    OsUpdatePolicyDataFetcher.class, OsUpdatePolicyService.class, OsUpdateOverrideService.class,
                    OsUpdatePolicyValidator.class, OsUpdatePolicyResponseMapper.class,
                    OsUpdatePolicyGraphQLMapper.class);

    @Test
    void osUpdateFlagAbsent_nothingOfTheReadSideRuns() {
        runner.run(context -> assertThat(context)
                .hasNotFailed()
                .doesNotHaveBean(DeviceOsDataFetcher.class)
                .doesNotHaveBean(DeviceOsStateService.class)
                .doesNotHaveBean(DeviceOsPendingUpdateService.class)
                .doesNotHaveBean(DeviceOsUpdateHistoryService.class)
                .doesNotHaveBean(DeviceOsResponseMapper.class)
                .doesNotHaveBean(DeviceOsGraphQLMapper.class)
                .doesNotHaveBean(OsUpdateDataFetcher.class)
                .doesNotHaveBean(OsUpdateService.class)
                .doesNotHaveBean(OsUpdateDeviceService.class)
                .doesNotHaveBean(OsUpdateResponseMapper.class)
                .doesNotHaveBean(OsUpdateGraphQLMapper.class)
                .doesNotHaveBean(OsUpdateDeviceCountsDataLoader.class)
                .doesNotHaveBean(OsUpdateCustomerStatusesDataLoader.class)
                .doesNotHaveBean(OsUpdatePolicyDataFetcher.class)
                .doesNotHaveBean(OsUpdatePolicyService.class)
                .doesNotHaveBean(OsUpdateOverrideService.class)
                .doesNotHaveBean(OsUpdatePolicyValidator.class)
                .doesNotHaveBean(OsUpdatePolicyResponseMapper.class)
                .doesNotHaveBean(OsUpdatePolicyGraphQLMapper.class));
    }

    @ParameterizedTest
    @ValueSource(strings = {"false", "yes"})
    void osUpdateFlagAnythingButTrue_nothingOfTheReadSideRuns(String value) {
        runner.withPropertyValues(FLAG + "=" + value).run(context -> assertThat(context)
                .hasNotFailed()
                .doesNotHaveBean(DeviceOsDataFetcher.class)
                .doesNotHaveBean(DeviceOsStateService.class)
                .doesNotHaveBean(DeviceOsPendingUpdateService.class)
                .doesNotHaveBean(DeviceOsUpdateHistoryService.class)
                .doesNotHaveBean(DeviceOsResponseMapper.class)
                .doesNotHaveBean(DeviceOsGraphQLMapper.class)
                .doesNotHaveBean(OsUpdateDataFetcher.class)
                .doesNotHaveBean(OsUpdateService.class)
                .doesNotHaveBean(OsUpdateDeviceService.class)
                .doesNotHaveBean(OsUpdateResponseMapper.class)
                .doesNotHaveBean(OsUpdateGraphQLMapper.class)
                .doesNotHaveBean(OsUpdateDeviceCountsDataLoader.class)
                .doesNotHaveBean(OsUpdateCustomerStatusesDataLoader.class)
                .doesNotHaveBean(OsUpdatePolicyDataFetcher.class)
                .doesNotHaveBean(OsUpdatePolicyService.class)
                .doesNotHaveBean(OsUpdateOverrideService.class)
                .doesNotHaveBean(OsUpdatePolicyValidator.class)
                .doesNotHaveBean(OsUpdatePolicyResponseMapper.class)
                .doesNotHaveBean(OsUpdatePolicyGraphQLMapper.class));
    }

    @Test
    void osUpdateFlagOn_wholeReadSideRuns() {
        runner.withPropertyValues(FLAG + "=true").run(context -> assertThat(context)
                .hasNotFailed()
                .hasSingleBean(DeviceOsDataFetcher.class)
                .hasSingleBean(DeviceOsStateService.class)
                .hasSingleBean(DeviceOsPendingUpdateService.class)
                .hasSingleBean(DeviceOsUpdateHistoryService.class)
                .hasSingleBean(CursorPageAssembler.class)
                .hasSingleBean(DeviceOsResponseMapper.class)
                .hasSingleBean(DeviceOsGraphQLMapper.class)
                .hasSingleBean(OsUpdateDataFetcher.class)
                .hasSingleBean(OsUpdateService.class)
                .hasSingleBean(OsUpdateDeviceService.class)
                .hasSingleBean(OsUpdateResponseMapper.class)
                .hasSingleBean(OsUpdateGraphQLMapper.class)
                .hasSingleBean(OsUpdateDeviceCountsDataLoader.class)
                .hasSingleBean(OsUpdateCustomerStatusesDataLoader.class)
                .hasSingleBean(OsUpdatePolicyDataFetcher.class)
                .hasSingleBean(OsUpdatePolicyService.class)
                .hasSingleBean(OsUpdateOverrideService.class)
                .hasSingleBean(OsUpdatePolicyValidator.class)
                .hasSingleBean(OsUpdatePolicyResponseMapper.class)
                .hasSingleBean(OsUpdatePolicyGraphQLMapper.class));
    }

    @Test
    void osUpdateFlagOn_servicesNamedApartFromTheClientCoreServicesOfTheSameClassName() {
        runner.withPropertyValues(FLAG + "=true").run(context -> assertThat(context)
                .hasNotFailed()
                .hasBean("apiDeviceOsStateService")
                .hasBean("apiDeviceOsPendingUpdateService")
                .hasBean("apiDeviceOsUpdateHistoryService")
                .hasBean("apiOsUpdateService")
                .hasBean("apiCursorPageAssembler"));
    }
}
