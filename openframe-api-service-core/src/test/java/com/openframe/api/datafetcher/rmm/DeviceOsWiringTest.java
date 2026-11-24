package com.openframe.api.datafetcher.rmm;

import com.openframe.api.dataloader.OsUpdateDeviceCountsDataLoader;
import com.openframe.api.mapper.DeviceOsGraphQLMapper;
import com.openframe.api.mapper.DeviceOsResponseMapper;
import com.openframe.api.mapper.OsUpdateGraphQLMapper;
import com.openframe.api.mapper.OsUpdateResponseMapper;
import com.openframe.api.service.rmm.osupdate.DeviceOsQueryService;
import com.openframe.api.service.rmm.osupdate.OsUpdateQueryService;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.rmm.osupdate.DeviceOsPendingUpdateRepository;
import com.openframe.data.repository.rmm.osupdate.DeviceOsStateRepository;
import com.openframe.data.repository.rmm.osupdate.DeviceOsUpdateHistoryRepository;
import com.openframe.data.repository.rmm.osupdate.OsUpdateRepository;
import com.openframe.data.service.TenantIdProvider;
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
            .withBean(TenantIdProvider.class, () -> mock(TenantIdProvider.class))
            .withUserConfiguration(DeviceOsDataFetcher.class, DeviceOsQueryService.class,
                    DeviceOsResponseMapper.class, DeviceOsGraphQLMapper.class,
                    OsUpdateDataFetcher.class, OsUpdateQueryService.class, OsUpdateResponseMapper.class,
                    OsUpdateGraphQLMapper.class, OsUpdateDeviceCountsDataLoader.class);

    @Test
    void osUpdateFlagAbsent_nothingOfTheReadSideRuns() {
        runner.run(context -> assertThat(context)
                .hasNotFailed()
                .doesNotHaveBean(DeviceOsDataFetcher.class)
                .doesNotHaveBean(DeviceOsQueryService.class)
                .doesNotHaveBean(DeviceOsResponseMapper.class)
                .doesNotHaveBean(DeviceOsGraphQLMapper.class)
                .doesNotHaveBean(OsUpdateDataFetcher.class)
                .doesNotHaveBean(OsUpdateQueryService.class)
                .doesNotHaveBean(OsUpdateResponseMapper.class)
                .doesNotHaveBean(OsUpdateGraphQLMapper.class)
                .doesNotHaveBean(OsUpdateDeviceCountsDataLoader.class));
    }

    @ParameterizedTest
    @ValueSource(strings = {"false", "yes"})
    void osUpdateFlagAnythingButTrue_nothingOfTheReadSideRuns(String value) {
        runner.withPropertyValues(FLAG + "=" + value).run(context -> assertThat(context)
                .hasNotFailed()
                .doesNotHaveBean(DeviceOsDataFetcher.class)
                .doesNotHaveBean(DeviceOsQueryService.class)
                .doesNotHaveBean(DeviceOsResponseMapper.class)
                .doesNotHaveBean(DeviceOsGraphQLMapper.class)
                .doesNotHaveBean(OsUpdateDataFetcher.class)
                .doesNotHaveBean(OsUpdateQueryService.class)
                .doesNotHaveBean(OsUpdateResponseMapper.class)
                .doesNotHaveBean(OsUpdateGraphQLMapper.class)
                .doesNotHaveBean(OsUpdateDeviceCountsDataLoader.class));
    }

    @Test
    void osUpdateFlagOn_wholeReadSideRuns() {
        runner.withPropertyValues(FLAG + "=true").run(context -> assertThat(context)
                .hasNotFailed()
                .hasSingleBean(DeviceOsDataFetcher.class)
                .hasSingleBean(DeviceOsQueryService.class)
                .hasSingleBean(DeviceOsResponseMapper.class)
                .hasSingleBean(DeviceOsGraphQLMapper.class)
                .hasSingleBean(OsUpdateDataFetcher.class)
                .hasSingleBean(OsUpdateQueryService.class)
                .hasSingleBean(OsUpdateResponseMapper.class)
                .hasSingleBean(OsUpdateGraphQLMapper.class)
                .hasSingleBean(OsUpdateDeviceCountsDataLoader.class));
    }
}
