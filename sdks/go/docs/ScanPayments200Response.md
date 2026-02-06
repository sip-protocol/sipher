# ScanPayments200Response

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Success** | Pointer to **bool** |  | [optional] 
**Data** | Pointer to [**ScanPayments200ResponseData**](ScanPayments200ResponseData.md) |  | [optional] 

## Methods

### NewScanPayments200Response

`func NewScanPayments200Response() *ScanPayments200Response`

NewScanPayments200Response instantiates a new ScanPayments200Response object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewScanPayments200ResponseWithDefaults

`func NewScanPayments200ResponseWithDefaults() *ScanPayments200Response`

NewScanPayments200ResponseWithDefaults instantiates a new ScanPayments200Response object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetSuccess

`func (o *ScanPayments200Response) GetSuccess() bool`

GetSuccess returns the Success field if non-nil, zero value otherwise.

### GetSuccessOk

`func (o *ScanPayments200Response) GetSuccessOk() (*bool, bool)`

GetSuccessOk returns a tuple with the Success field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetSuccess

`func (o *ScanPayments200Response) SetSuccess(v bool)`

SetSuccess sets Success field to given value.

### HasSuccess

`func (o *ScanPayments200Response) HasSuccess() bool`

HasSuccess returns a boolean if a field has been set.

### GetData

`func (o *ScanPayments200Response) GetData() ScanPayments200ResponseData`

GetData returns the Data field if non-nil, zero value otherwise.

### GetDataOk

`func (o *ScanPayments200Response) GetDataOk() (*ScanPayments200ResponseData, bool)`

GetDataOk returns a tuple with the Data field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetData

`func (o *ScanPayments200Response) SetData(v ScanPayments200ResponseData)`

SetData sets Data field to given value.

### HasData

`func (o *ScanPayments200Response) HasData() bool`

HasData returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


