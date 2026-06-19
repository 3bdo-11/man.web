package com.man.app;

import com.getcapacitor.BridgeActivity;
import com.man.app.plugins.ScreenTimePlugin;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(ScreenTimePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
