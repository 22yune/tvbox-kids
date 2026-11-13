package com.github.catvod.crawler;

import android.content.Context;

import java.util.HashMap;
import java.util.List;

/**
 * 编译用的最小桩类，签名必须与 FongMi catvod 的 Spider 保持一致。
 * 只参与编译，不会打进 spider/kids.jar。
 */
public abstract class Spider {

    public void init(Context context) throws Exception {
    }

    public void init(Context context, String extend) throws Exception {
        init(context);
    }

    public String homeContent(boolean filter) throws Exception {
        return "{\"class\":[]}";
    }

    public String homeVideoContent() throws Exception {
        return "{\"list\":[]}";
    }

    public String categoryContent(String tid, String pg, boolean filter, HashMap<String, String> extend) throws Exception {
        return "{\"list\":[]}";
    }

    public String detailContent(List<String> ids) throws Exception {
        return "{\"list\":[]}";
    }

    public String searchContent(String key, boolean quick) throws Exception {
        return searchContent(key, quick, "1");
    }

    public String searchContent(String key, boolean quick, String pg) throws Exception {
        return "{\"list\":[]}";
    }

    public String playerContent(String flag, String id, List<String> vipFlags) throws Exception {
        return "{}";
    }

    public void destroy() {
    }
}
