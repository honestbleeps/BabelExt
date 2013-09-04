#pragma once

#include "SyncMap.h"

class BrowserRefreshDetector
{
	static char DocumentRefreshMark[];
	static SyncMap<DWORD, BrowserRefreshDetector*, true> DetectorByThread;
	static VOID CALLBACK RefreshDetectorTimerProc(HWND hwnd, UINT uMsg, UINT_PTR idEvent, DWORD dwTime);

	UINT_PTR idTimer;
	bool CheckDocumentSignature();
	READYSTATE GetReadyState();
	void EmulateDocumentComplete();
	void DetectRefresh();
	void SetDetectTimer();
	void KillDetectTimer();

public:

	int nDownloadsCount;

	BrowserRefreshDetector();
	~BrowserRefreshDetector(void);

	void ProcessDownloadBegin(bool bNeedDelay);
	void ProcessDownloadEnd(bool bNeedDelay);
	bool IsBrowserBusy();
	void SignDocument();

	virtual HRESULT OnDocumentComplete_doIt(IDispatch *pDisp, VARIANT *URL, bool realOne) = 0;
	virtual IWebBrowser2* GetBrowser() = 0;
};
