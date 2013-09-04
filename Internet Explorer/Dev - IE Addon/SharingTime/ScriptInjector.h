#pragma once

class ScriptInjector
{
public:
	ScriptInjector(void);
	~ScriptInjector(void);

	void InjectScript(IWebBrowser2 *pBrowser, CString url);
};
