package com.openframe.data.repository.delivery;

public interface CustomMachineDeliverySequenceRepository {

    int next(String id, String machineId);
}
