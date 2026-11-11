package com.openframe.publishing.repository;

import com.openframe.publishing.fixture.Widgets.Widget;

// A publishing marker on a custom method: the interceptor would ignore it, so startup refuses it.
public class MarkedFragmentImpl implements MarkedFragment {

    @Override
    public Widget touch(String id) {
        throw new UnsupportedOperationException("never called: the service does not start");
    }
}
