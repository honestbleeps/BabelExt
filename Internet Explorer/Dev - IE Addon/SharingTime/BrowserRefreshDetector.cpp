#include "stdafx.h"
#include "BrowserRefreshDetector.h"
#include <DispEx.h>
#include <exdispid.h>

/*static*/ SyncMap<DWORD, BrowserRefreshDetector*, true> BrowserRefreshDetector::DetectorByThread;
/*static*/ char BrowserRefreshDetector::DocumentRefreshMark[] = "STI_Refresh";

BrowserRefreshDetector::BrowserRefreshDetector():
	nDownloadsCount(0),
	idTimer(0)
{
	MyDebug(_T("Create"));
}

BrowserRefreshDetector::~BrowserRefreshDetector(void)
{
	MyDebug(_T("Destroy"));
	KillDetectTimer();
}

void BrowserRefreshDetector::SetDetectTimer()
{
	MyDebug(_T("SetTimer"));

	DetectorByThread[GetCurrentThreadId()] = this;
	KillTimer(NULL, idTimer);
	idTimer = SetTimer(NULL, 0, 500, &BrowserRefreshDetector::RefreshDetectorTimerProc);
}

void BrowserRefreshDetector::KillDetectTimer()
{
	MyDebug(_T("KillTimer"));
	KillTimer(NULL, idTimer);
}

void BrowserRefreshDetector::ProcessDownloadBegin(bool bNeedDelay)
{
	MyDebug(_T("DownloadBegin"));
	nDownloadsCount++;
}

void BrowserRefreshDetector::ProcessDownloadEnd(bool bNeedDelay)
{
	MyDebug(_T("DownloadEnd"));
	if(--nDownloadsCount < 0)
		nDownloadsCount = 0;

	if(!bNeedDelay && !nDownloadsCount)
	{
		SetDetectTimer();
	}
}

void BrowserRefreshDetector::EmulateDocumentComplete()
{
	MyDebug(_T("EmulateDocumentComplete"));
	BSTR bsLoc;
	GetBrowser()->get_LocationURL(&bsLoc);
	CString sURL = (TCHAR*)_bstr_t(bsLoc, false);
	_variant_t varURL((LPCTSTR)sURL);
	OnDocumentComplete_doIt(GetBrowser(), &varURL, false);
}

bool BrowserRefreshDetector::IsBrowserBusy()
{
	return nDownloadsCount > 0;
}

VOID CALLBACK BrowserRefreshDetector::RefreshDetectorTimerProc( HWND hwnd, UINT uMsg, UINT_PTR idEvent, DWORD dwTime )
{
	MyDebug(_T("OnTimer"));
	BrowserRefreshDetector *pThis = DetectorByThread[GetCurrentThreadId()];
	pThis->DetectRefresh();
}

READYSTATE BrowserRefreshDetector::GetReadyState()
{
	READYSTATE bstate;
	GetBrowser()->get_ReadyState(&bstate);
	return bstate;
}

bool BrowserRefreshDetector::CheckDocumentSignature()
{
	try {

		CComPtr<IDispatch> pDispDoc;
		GetBrowser()->get_Document(&pDispDoc);
		CComQIPtr<IHTMLDocument2> pDoc2 = pDispDoc;
		if(pDoc2)
		{
			CComPtr<IHTMLWindow2> ptrHTMLWnd2;
			pDoc2->get_parentWindow(&ptrHTMLWnd2);

			// ptrHTMLWnd2 is pointer to IHTMLWindow2
			CComQIPtr<IDispatchEx> ptrDispEx = ptrHTMLWnd2;
			DISPID dispid = DISPID_UNKNOWN;

			// Create new property
			CComBSTR bstrProp(DocumentRefreshMark);
			HRESULT hr = ptrDispEx->GetDispID(bstrProp,
				fdexNameCaseSensitive | fdexNameEnsure, &dispid);
			ATLASSERT(SUCCEEDED(hr) && dispid != DISPID_UNKNOWN);

			_variant_t vProp;

			// put my object into new property
			CComDispatchDriver ptrDispDrv = ptrDispEx;
			ptrDispDrv.GetProperty(dispid, &vProp);

			bool bRes = (vProp.vt != VT_EMPTY);
			MyDebug(_T("CheckDocumentSignature, res=%d"), bRes);
			return bRes;
		}

	} catch(...) {};

	MyDebug(_T("CheckDocumentSignature, no document or crash"));

	return false;
}

void BrowserRefreshDetector::SignDocument()
{
	MyDebug(_T("Sign Document"));

	try {

		CComPtr<IDispatch> pDispDoc;
		GetBrowser()->get_Document(&pDispDoc);
		CComQIPtr<IHTMLDocument2> pDoc2 = pDispDoc;
		if(pDoc2)
		{
			CComPtr<IHTMLWindow2> ptrHTMLWnd2;
			pDoc2->get_parentWindow(&ptrHTMLWnd2);

			// ptrHTMLWnd2 is pointer to IHTMLWindow2
			CComQIPtr<IDispatchEx> ptrDispEx = ptrHTMLWnd2;
			DISPID dispid = DISPID_UNKNOWN;

			// Create new property
			CComBSTR bstrProp(DocumentRefreshMark);
			HRESULT hr = ptrDispEx->GetDispID(bstrProp,
				fdexNameCaseSensitive | fdexNameEnsure, &dispid);
			ATLASSERT(SUCCEEDED(hr) && dispid != DISPID_UNKNOWN);

			// put my object into new property
			CComVariant varInstProp(true);
			CComDispatchDriver ptrDispDrv = ptrDispEx;
			hr = ptrDispDrv.PutProperty(dispid, &varInstProp);
		}

	} catch(...) {};
}

void BrowserRefreshDetector::DetectRefresh()
{
	READYSTATE rs = GetReadyState();
	MyDebug(_T("DetectRefresh, %d"), rs);

	switch(rs)
	{
	case READYSTATE_COMPLETE:
		//case READYSTATE_INTERACTIVE:
		break;
	default:
		return;
	}

	KillDetectTimer();

	if(CheckDocumentSignature())
		return;

	SignDocument();
	EmulateDocumentComplete();
}