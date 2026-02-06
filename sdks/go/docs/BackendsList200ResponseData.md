# BackendsList200ResponseData

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Backends** | Pointer to [**[]BackendsList200ResponseDataBackendsInner**](BackendsList200ResponseDataBackendsInner.md) |  | [optional] 
**Total** | Pointer to **int32** |  | [optional] 
**TotalEnabled** | Pointer to **int32** |  | [optional] 

## Methods

### NewBackendsList200ResponseData

`func NewBackendsList200ResponseData() *BackendsList200ResponseData`

NewBackendsList200ResponseData instantiates a new BackendsList200ResponseData object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewBackendsList200ResponseDataWithDefaults

`func NewBackendsList200ResponseDataWithDefaults() *BackendsList200ResponseData`

NewBackendsList200ResponseDataWithDefaults instantiates a new BackendsList200ResponseData object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetBackends

`func (o *BackendsList200ResponseData) GetBackends() []BackendsList200ResponseDataBackendsInner`

GetBackends returns the Backends field if non-nil, zero value otherwise.

### GetBackendsOk

`func (o *BackendsList200ResponseData) GetBackendsOk() (*[]BackendsList200ResponseDataBackendsInner, bool)`

GetBackendsOk returns a tuple with the Backends field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetBackends

`func (o *BackendsList200ResponseData) SetBackends(v []BackendsList200ResponseDataBackendsInner)`

SetBackends sets Backends field to given value.

### HasBackends

`func (o *BackendsList200ResponseData) HasBackends() bool`

HasBackends returns a boolean if a field has been set.

### GetTotal

`func (o *BackendsList200ResponseData) GetTotal() int32`

GetTotal returns the Total field if non-nil, zero value otherwise.

### GetTotalOk

`func (o *BackendsList200ResponseData) GetTotalOk() (*int32, bool)`

GetTotalOk returns a tuple with the Total field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetTotal

`func (o *BackendsList200ResponseData) SetTotal(v int32)`

SetTotal sets Total field to given value.

### HasTotal

`func (o *BackendsList200ResponseData) HasTotal() bool`

HasTotal returns a boolean if a field has been set.

### GetTotalEnabled

`func (o *BackendsList200ResponseData) GetTotalEnabled() int32`

GetTotalEnabled returns the TotalEnabled field if non-nil, zero value otherwise.

### GetTotalEnabledOk

`func (o *BackendsList200ResponseData) GetTotalEnabledOk() (*int32, bool)`

GetTotalEnabledOk returns a tuple with the TotalEnabled field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetTotalEnabled

`func (o *BackendsList200ResponseData) SetTotalEnabled(v int32)`

SetTotalEnabled sets TotalEnabled field to given value.

### HasTotalEnabled

`func (o *BackendsList200ResponseData) HasTotalEnabled() bool`

HasTotalEnabled returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


