package com.openframe.data.repository.rmm;

import com.openframe.data.document.rmm.schedule.ScheduleLocalMachineTimeDispatch;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

@Repository
public interface ScheduleDeviceLocalDispatchRepository extends MongoRepository<ScheduleLocalMachineTimeDispatch, String> {

    List<ScheduleLocalMachineTimeDispatch> findByScheduleIdAndMachineIdIn(String scheduleId, Collection<String> machineIds);

    long deleteByScheduleId(String scheduleId);
}
