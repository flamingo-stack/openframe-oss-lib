package com.openframe.client.listener.packageupdate;

import com.openframe.data.nats.packageupdate.PackageUpdateStatusMessage;

public interface PackageUpdateStatusProcessor {

    void process(String machineId, PackageUpdateStatusMessage event);
}
