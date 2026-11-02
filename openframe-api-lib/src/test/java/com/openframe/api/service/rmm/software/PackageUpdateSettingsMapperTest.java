package com.openframe.api.service.rmm.software;

import com.openframe.api.dto.rmm.software.PackageUpdateSettingsInput;
import com.openframe.api.dto.rmm.software.SoftwareAutoUpdateInput;
import com.openframe.core.exception.BadRequestException;
import com.openframe.data.document.rmm.software.PackageUpdateMode;
import com.openframe.data.document.rmm.software.PackageUpdateSettings;
import com.openframe.data.document.rmm.software.SoftwareAction;
import com.openframe.data.document.rmm.software.SoftwareAutoUpdate;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PackageUpdateSettingsMapperTest {

    @Test
    @DisplayName("UPDATE without settings: the screen's defaults, wait, then a 5-minute countdown 7 days after the first try")
    void updateSettings_updateWithoutSettings_screenDefaults() {
        PackageUpdateSettings settings = PackageUpdateSettingsMapper.updateSettings(SoftwareAction.UPDATE, null);

        assertThat(settings.getMode()).isEqualTo(PackageUpdateMode.WAIT);
        assertThat(settings.getDeadlineSeconds()).isEqualTo(604_800L);
        assertThat(settings.getCountdownSeconds()).isEqualTo(300);
    }

    @Test
    @DisplayName("UPDATE, wait without a deadline: kept as given, the update waits for the user")
    void updateSettings_waitWithoutDeadline_keptAsGiven() {
        PackageUpdateSettings settings = PackageUpdateSettingsMapper.updateSettings(SoftwareAction.UPDATE,
                settings(PackageUpdateMode.WAIT, null, 120));

        assertThat(settings.getMode()).isEqualTo(PackageUpdateMode.WAIT);
        assertThat(settings.getDeadlineSeconds()).isNull();
        assertThat(settings.getCountdownSeconds()).isEqualTo(120);
    }

    @Test
    @DisplayName("UPDATE, force: the deadline is dropped, a forced install closes the app at once")
    void updateSettings_force_deadlineDropped() {
        PackageUpdateSettings settings = PackageUpdateSettingsMapper.updateSettings(SoftwareAction.UPDATE,
                settings(PackageUpdateMode.FORCE, 86_400L, 60));

        assertThat(settings.getMode()).isEqualTo(PackageUpdateMode.FORCE);
        assertThat(settings.getDeadlineSeconds()).isNull();
        assertThat(settings.getCountdownSeconds()).isEqualTo(60);
    }

    @Test
    @DisplayName("INSTALL: no settings, and settings sent with it are rejected")
    void updateSettings_install_noneAndGivenRejected() {
        assertThat(PackageUpdateSettingsMapper.updateSettings(SoftwareAction.INSTALL, null)).isNull();
        assertThatThrownBy(() -> PackageUpdateSettingsMapper.updateSettings(SoftwareAction.INSTALL,
                settings(PackageUpdateMode.WAIT, null, 300)))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("updateSettings");
    }

    @Test
    @DisplayName("UPDATE without auto-update: off")
    void autoUpdate_updateWithoutInput_off() {
        SoftwareAutoUpdate autoUpdate = PackageUpdateSettingsMapper.autoUpdate(SoftwareAction.UPDATE, null);

        assertThat(autoUpdate.isEnabled()).isFalse();
        assertThat(autoUpdate.getSettings()).isNull();
    }

    @Test
    @DisplayName("auto-update on without settings: the same settings as the update")
    void autoUpdate_enabledWithoutSettings_sameAsTheUpdate() {
        SoftwareAutoUpdate autoUpdate = PackageUpdateSettingsMapper.autoUpdate(SoftwareAction.UPDATE, autoUpdate(true, null));

        assertThat(autoUpdate.isEnabled()).isTrue();
        assertThat(autoUpdate.getSettings()).isNull();
    }

    @Test
    @DisplayName("auto-update on with settings: its own settings, read by the same rules as the update's")
    void autoUpdate_enabledWithSettings_ownSettings() {
        SoftwareAutoUpdate autoUpdate = PackageUpdateSettingsMapper.autoUpdate(SoftwareAction.UPDATE,
                autoUpdate(true, settings(PackageUpdateMode.FORCE, 3_600L, 30)));

        assertThat(autoUpdate.isEnabled()).isTrue();
        assertThat(autoUpdate.getSettings().getMode()).isEqualTo(PackageUpdateMode.FORCE);
        assertThat(autoUpdate.getSettings().getDeadlineSeconds()).isNull();
        assertThat(autoUpdate.getSettings().getCountdownSeconds()).isEqualTo(30);
    }

    @Test
    @DisplayName("auto-update off: settings sent with it are dropped")
    void autoUpdate_disabled_settingsDropped() {
        SoftwareAutoUpdate autoUpdate = PackageUpdateSettingsMapper.autoUpdate(SoftwareAction.UPDATE,
                autoUpdate(false, settings(PackageUpdateMode.WAIT, null, 300)));

        assertThat(autoUpdate.isEnabled()).isFalse();
        assertThat(autoUpdate.getSettings()).isNull();
    }

    @Test
    @DisplayName("INSTALL: no auto-update, and auto-update sent with it is rejected")
    void autoUpdate_install_noneAndGivenRejected() {
        assertThat(PackageUpdateSettingsMapper.autoUpdate(SoftwareAction.INSTALL, null)).isNull();
        assertThatThrownBy(() -> PackageUpdateSettingsMapper.autoUpdate(SoftwareAction.INSTALL, autoUpdate(true, null)))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("autoUpdate");
    }

    private static PackageUpdateSettingsInput settings(PackageUpdateMode mode, Long deadlineSeconds, int countdownSeconds) {
        PackageUpdateSettingsInput input = new PackageUpdateSettingsInput();
        input.setMode(mode);
        input.setDeadlineSeconds(deadlineSeconds);
        input.setCountdownSeconds(countdownSeconds);
        return input;
    }

    private static SoftwareAutoUpdateInput autoUpdate(boolean enabled, PackageUpdateSettingsInput settings) {
        SoftwareAutoUpdateInput input = new SoftwareAutoUpdateInput();
        input.setEnabled(enabled);
        input.setSettings(settings);
        return input;
    }
}
