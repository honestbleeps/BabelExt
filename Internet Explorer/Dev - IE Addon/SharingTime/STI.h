// STI.h : Declaration of the CSTI

#pragma once
#include "resource.h"       // main symbols
#include "BrowserRefreshDetector.h"
#include <ExDispid.h>
#include "ST_i.h"
#include "ScriptInjector.h"


#if defined(_WIN32_WCE) && !defined(_CE_DCOM) && !defined(_CE_ALLOW_SINGLE_THREADED_OBJECTS_IN_MTA)
#error "Single-threaded COM objects are not properly supported on Windows CE platform, such as the Windows Mobile platforms that do not include full DCOM support. Define _CE_ALLOW_SINGLE_THREADED_OBJECTS_IN_MTA to force ATL to support creating single-thread COM object's and allow use of it's single-threaded COM object implementations. The threading model in your rgs file was set to 'Free' as that is the only threading model supported in non DCOM Windows CE platforms."
#endif



// CSTI

class ATL_NO_VTABLE CSTI :
	public CComObjectRootEx<CComSingleThreadModel>,
	public CComCoClass<CSTI, &CLSID_STI>,
	public IObjectWithSiteImpl<CSTI>,
	public IDispatchImpl<ISTI, &IID_ISTI, &LIBID_STLib, /*wMajor =*/ 1, /*wMinor =*/ 0>,
	public IDispEventImpl<1, CSTI, &DIID_DWebBrowserEvents2, &LIBID_SHDocVw, 1, 0>,
	public BrowserRefreshDetector,
	public ScriptInjector
{
	typedef IDispEventImpl<1, CSTI, &DIID_DWebBrowserEvents2, &LIBID_SHDocVw, 1, 0> EventsImpl;

	CComQIPtr<IWebBrowser2> pWebBrowser;

public:
	CSTI()
	{
	}

DECLARE_REGISTRY_RESOURCEID(IDR_STI)

DECLARE_NOT_AGGREGATABLE(CSTI)

BEGIN_COM_MAP(CSTI)
	COM_INTERFACE_ENTRY(ISTI)
	COM_INTERFACE_ENTRY(IDispatch)
	COM_INTERFACE_ENTRY(IObjectWithSite)
END_COM_MAP()

BEGIN_SINK_MAP(CSTI)
	SINK_ENTRY_EX(1, DIID_DWebBrowserEvents2, DISPID_BEFORENAVIGATE2, OnBeforeNavigate)
	SINK_ENTRY_EX(1, DIID_DWebBrowserEvents2, DISPID_DOWNLOADBEGIN, OnDownloadBegin)
	SINK_ENTRY_EX(1, DIID_DWebBrowserEvents2, DISPID_DOWNLOADCOMPLETE, OnDownloadComplete)
	SINK_ENTRY_EX(1, DIID_DWebBrowserEvents2, DISPID_DOCUMENTCOMPLETE, OnDocumentComplete)
	SINK_ENTRY_EX(1, DIID_DWebBrowserEvents2, DISPID_NAVIGATECOMPLETE2 , OnNavigateComplete2)
END_SINK_MAP()

	DECLARE_PROTECT_FINAL_CONSTRUCT()

	HRESULT FinalConstruct()
	{
		return S_OK;
	}

	void FinalRelease()
	{
	}

	STDMETHOD(SetSite)(IUnknown *pUnkSite);

public:

	STDMETHOD(OnBeforeNavigate) (IDispatch* pDisp , VARIANT* URL,
		VARIANT* Flags, VARIANT* TarGetFrameName,
		VARIANT* PostData, VARIANT* Headers, BOOL* Cancel);
	STDMETHOD(OnDownloadBegin) ();
	STDMETHOD(OnDownloadComplete) ();
	STDMETHOD(OnDocumentComplete)(IDispatch *pDisp, VARIANT *_url);	
	STDMETHOD(OnNavigateComplete2)(IDispatch *pDisp, VARIANT *_url);	

public:

	virtual HRESULT OnDocumentComplete_doIt(IDispatch *pDisp, VARIANT *URL, bool realOne);
	virtual IWebBrowser2* GetBrowser();
};

OBJECT_ENTRY_AUTO(__uuidof(STI), CSTI)
