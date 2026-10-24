package com.openframe.publishing.repository;

import com.openframe.publishing.fixture.Widgets.Widget;

public interface MarkedFragment {

    @PublishesChange
    Widget touch(String id);
}
